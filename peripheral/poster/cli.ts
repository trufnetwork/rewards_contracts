import {ethers} from "ethers";
import fs from "fs";
import pino from "pino";

import {EVMPoster, KwilAPI, base64ToBytes32} from "./poster";
import {RewardSafe} from "../lib/gnosis";
import {State} from "./state";
import {RewardContractABI} from "../lib/reward";

interface PosterConfig {
    "eth_rpc": string,
    "private_key": string,
    "kwil_rpc": string,
    "kwil_chain_id": string,
    "kwil_erc20_alias": string,
    "sync_every": 60000, // milliseconds
    "gwei_extra_tip": number,
    "gwei_max_fee_per_gas": number,
    "blocks_before_speedup": number,
    "state_file": string,
}

function getLogger(): pino.Logger {
    return pino(
            {
                level: "info",
                formatters: {
                    level: (label) => {
                        return { level: label.toUpperCase() };
                    },
                },
                timestamp: pino.stdTimeFunctions.isoTime,
            },
            pino.transport({
                targets: [
                    {
                        level: 'info',
                        target: 'pino/file',
                        options: {
                            destination: 1, // stdout
                            mkdir: true,
                        },
                    },
                ],
            })
        );

    // NOTE: this could work if we remove the options(first parameter)
    // logger = pino(
    //     {
    //         level: "info",
    //         formatters: {
    //             level: (label) => {
    //                 return { level: label.toUpperCase() };
    //             },
    //         },
    //         timestamp: pino.stdTimeFunctions.isoTime,
    //     },
    //     pino.transport({
    //         targets: [
    //             {
    //                 level: 'info',
    //                 target: 'pino/file',
    //                 options: {
    //                     destination: logfile,
    //                     mkdir: true,
    //                     // timestamp: pino.stdTimeFunctions.isoTime(),
    //                 },
    //             },
    //             {
    //                 target: 'pino-pretty',
    //                 options: { destination: 1, colorize: true },
    //             }
    //         ],
    //     })
    // );
}

function loadConfig(configPath: string): PosterConfig {
    const configJSON = fs.readFileSync(configPath, "utf-8");
    const cfg = JSON.parse(configJSON);
    if (cfg.state_file == undefined) {
        console.log("No state file is specified.");
        process.exit(1);
    }

    if (cfg.eth_rpc == "") {
        console.log("No eth rpc is specified.");
        process.exit(1);
    }

    if (cfg.private_key == "") {
        console.log("No private key is specified.");
        process.exit(1);
    }

    if (cfg.log_file == "") {
        console.log("No log file is specified. Will log to stdout.");
    }

    if (cfg.sync_every == undefined) {
        cfg.sync_every = 60000;
    }

    if (cfg.gwei_extra_tip == undefined) {
        cfg.gwei_extra_tip = 5;
    }

    if (cfg.gwei_max_fee_per_gas == undefined) {
        cfg.gwei_max_fee_per_gas = 100;
    }

    if (cfg.blocks_before_speedup == undefined) {
        cfg.blocks_before_speedup = 270;
    }

    return cfg
}

async function main(): Promise<void> {
    if (process.argv.length != 3) {
        console.log("Usage: npx tsx ./cli.ts config-json-path");
        process.exit(1);
    }

    const logger = getLogger();

    const configPath:string = process.argv[2]
    const cfg = loadConfig(configPath);

    const kwil = new KwilAPI(cfg.kwil_rpc, cfg.kwil_chain_id, cfg.kwil_erc20_alias)

    const rewardInstance = await kwil.Info();
    logger.info(rewardInstance, "target erc20-bridge instance");

    let state: State = new State(); // in memory state
    if (cfg.state_file != "") {
        if (!fs.existsSync(cfg.state_file)) {
            fs.writeFileSync(cfg.state_file, "");
        }
        state = State.LoadStateFromFile(cfg.state_file);
    }

    const eth = new ethers.JsonRpcProvider(cfg.eth_rpc);
    const rewardContract = new ethers.Contract(rewardInstance.escrow.toString(), RewardContractABI, eth);
    const safeAddr = await rewardContract.safe()

    const ethNetwork = await eth.getNetwork();
    const rewardSafe = new RewardSafe(cfg.eth_rpc, ethNetwork.chainId, rewardInstance.escrow, safeAddr);
    const posterSigner = new ethers.Wallet(cfg.private_key, eth);

    // log the configuration
    const cfgForLog = {...cfg};
    cfgForLog.private_key = "***";
    logger.info({config: cfgForLog},"Loaded config");

    const p = new EVMPoster(
        rewardSafe,
        rewardContract,
        posterSigner,
        kwil,
        eth,
        logger,
        state,
        cfg.gwei_extra_tip,
        cfg.gwei_max_fee_per_gas,
        cfg.blocks_before_speedup
    );

    console.log(`Starting the poster. Press Ctrl-C to quit.`);

    await p.runOnce() // run first time
    const intervalHandler = setInterval(async () => {
        try {
            await p.runOnce();
        } catch (err) {
            logger.warn(err, "Error during poster run");
        }
    }, cfg.sync_every);


    ['SIGINT', 'SIGTERM', 'SIGQUIT']
        .forEach(signal => process.on(signal, () => {
            logger.warn("Termination signal received. Cleaning up...");
            clearInterval(intervalHandler);
            process.exit(0);
        }));
}

main().catch(console.error);