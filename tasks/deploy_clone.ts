import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {parseUnits} from "ethers";
import {task, types} from "hardhat/config";
import {getChainSpecificDeployerSaltNonce} from "../peripheral/lib/reward";


task("deploy-clone",
    "Deploy a clone contract using the factory")
    .addOptionalParam("posterFee", "poster fee in Ether", "0.0001", types.string)
    .addOptionalParam("factory", "factory contract address; deployed address will be used if not specify", "", types.string)
    .addOptionalParam("singleton", "singleton contract address; deployed address will be used if not specify", "", types.string)
    .addPositionalParam("safe", "safe wallet contract address", undefined, types.string, false)
    .addPositionalParam("escrowToken", "erc20 token address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            let deployed: Record<string, string> = {};

            switch (chainId) {
                case 11155111: {
                    deployed = require("../ignition/deployments/chain-11155111/deployed_addresses.json");
                    break;
                }
                case 31337: { // hardhat local node
                    deployed = require("../ignition/deployments/chain-31337/deployed_addresses.json");
                    break;
                }
                default: {
                    // const rewardToken = await hre.ethers.getContractAt("ERC20", );
                    console.log(`'${hre.network.name}' network is not supported yet`);
                }
            }

            let deployedSingleton: string = deployed["RewardDistributorSingletonModule#RewardDistributor"];
            let deployedFactory: string = deployed["RewardDistributorFactoryModule#RewardDistributorFactory"];

            if (taskArgs.factory ) {
                deployedFactory = taskArgs.factory;
            }

            if (taskArgs.singleton) {
                deployedSingleton = taskArgs.singleton;
            }

            if (!deployedSingleton || !deployedFactory) {
                console.log("factory/singleton addresses are not configured")
                return;
            }

            const [deployer] = await hre.ethers.getSigners();
            const deployerNonce = await deployer.getNonce()
            const saltNonce = getChainSpecificDeployerSaltNonce(chainId.toString(),
                deployer.address,
                deployerNonce.toString());

            await deploy(hre, deployer, deployedFactory,
                taskArgs.safe, taskArgs.posterFee, taskArgs.escrowToken, saltNonce);
        }
    );


async function deploy(hre: HardhatRuntimeEnvironment, deployer:HardhatEthersSigner, factoryAddr: string,
                      safeAddr: string, initFee: string, tokenAddr: string, saltNonce: string) {
    if (!safeAddr) {
        console.log("safe address is not configured")
        return;
    }

    if (tokenAddr == "") {
        console.log("reward token address is not configured")
        return;
    }

    console.log(">>> ")
    console.log('Deployer/Owner address: ', deployer.address);
    console.log(`Target Factory Address: ${factoryAddr}`);
    console.log(`Safe Address: ${safeAddr}`);
    console.log(`Init Fee: ${initFee} eth`);
    console.log(`Token Address: ${tokenAddr}`);
    console.log(`Salt Nonce: ${saltNonce}`);

    const token = await hre.ethers.getContractAt("ERC20", tokenAddr);

    const factory= await hre.ethers.getContractAt("RewardDistributorFactory", factoryAddr);

    const predictAddr = await factory.predicateAddr(saltNonce);
    const txResp = await factory.connect(deployer).create(
        safeAddr, parseUnits(initFee, "ether"), tokenAddr, saltNonce)
    // console.log("txResp", txResp);
    const txRecipt = await txResp.wait();
    // console.log("txRecipt", txRecipt);

    const newClone = await hre.ethers.getContractAt("RewardDistributor", predictAddr);

    console.log(">>> ")
    console.log("Escrow Contract deployed to: ", await newClone.getAddress());
    // console.log("Contract's safe", await newClone.safe());
    // console.log("Contract's posterFee", await newClone.posterFee());
    // console.log("Contract's rewardToken", await newClone.rewardToken());
    // console.log("Contract's initial token balance", await token.balanceOf(newClone));
}
