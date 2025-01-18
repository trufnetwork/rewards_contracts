import {ethers} from "ethers";
import fs from "fs";
import pino from "pino";

import {EVMPoster, KwilAPI} from "./poster";
import {RewardSafe} from "../lib/gnosis";
import {State} from "./state";

interface PosterConfig {
    "eth_rpc": string,
    "private_key": string,
    "safe_address": string,
    "reward_address": string,
    "sync_every": number,
    "kwil_rpc": string,
    "kwil_chain_id": string,
    "kwil_namespace": string,
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
    if (cfg.state_file == "") {
        console.log("No state file is specified.");
        process.exit(1);
    }

    if (cfg.log_file == "") {
        console.log("No log file is specified. Will log to stdout.");
    }

    return cfg
}

async function main(): Promise<void> {
    console.log("======", process.argv)
    // if (process.argv.length != 2) {
    //     console.log("Usage: kwil-reward-poster config-json-path");
    // }

    if (process.argv.length != 3) {
        console.log("Usage: npx tsx ./cli.ts config-json-path");
        process.exit(1);
    }

    const configPath:string = process.argv[2]
    const cfg = loadConfig(configPath);

    const kwil = new KwilAPI(cfg.kwil_rpc, cfg.kwil_chain_id, cfg.kwil_namespace)
    try {
        await kwil.LatestFinalized(1)
    } catch (err) {
        console.log("Cannot connecting to kwil", err);
        process.exit(1);
    }

    let state: State;
    if (cfg.state_file == "") {
        state = new State(); // in memory state
    } else {
        state = State.LoadStateFromFile(cfg.state_file);
    }

    const eth = new ethers.JsonRpcProvider(cfg.eth_rpc);
    const ethNetwork = await eth.getNetwork();
    const rewardSafe = new RewardSafe(cfg.eth_rpc, ethNetwork.chainId, cfg.safe_address, cfg.reward_address);
    const posterSigner = new ethers.Wallet(cfg.private_key, eth);

    const logger = getLogger();
    // log the configuration
    const cfgForLog = {...cfg};
    cfgForLog.private_key = "***";
    logger.info({config: cfgForLog},"Loaded config");

    const p = new EVMPoster(
        rewardSafe,
        cfg.reward_address,
        posterSigner,
        kwil,
        eth,
        state,
        logger,
    );

    console.log(`Starting the poster. Press Ctrl-C to quit.`);

    await p.fastSync(); // sync first
    await p.runOnce() // run first time
    const intervalHandler = setInterval(async () => {
        try {
            await p.runOnce();
        } catch (err) {
            logger.warn(err, "Error during poster run");
        }
    }, cfg.sync_every);

    process.on("SIGINT", () => {
        logger.warn("Termination signal received. Cleaning up...");
        clearInterval(intervalHandler);
        process.exit(0);
    });
}

main().catch(console.error);