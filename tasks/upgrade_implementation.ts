import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task, types} from "hardhat/config";

task("upgrade-implementation",
    "Upgrade the proxy implementation to a new version")
    .addOptionalParam("factory", "factory contract address; deployed address will be used if not specify", "", types.string)
    .addPositionalParam("newImplementation", "new implementation contract address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const deployed = require(`../ignition/deployments/chain-${chainId.toString()}/deployed_addresses.json`);
            let deployedFactory: string = deployed["RewardDistributorFactoryModule#RewardDistributorFactory"];

            if (taskArgs.factory) {
                deployedFactory = taskArgs.factory;
            }

            if (!deployedFactory) {
                console.log("factory address is not configured")
                return;
            }

            const [deployer] = await hre.ethers.getSigners();

            await upgrade(hre, deployer, deployedFactory, taskArgs.newImplementation);
        }
    );

async function upgrade(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner, 
                     factoryAddr: string, newImplAddr: string) {
    if (!newImplAddr) {
        console.log("new implementation address is required")
        return;
    }

    console.log(">>> ")
    console.log('Upgrader address: ', deployer.address);
    console.log(`Factory Address: ${factoryAddr}`);
    console.log(`New Implementation Address: ${newImplAddr}`);

    const factory = await hre.ethers.getContractAt("RewardDistributorFactory", factoryAddr);
    
    const currentImpl = await factory.implementation();
    console.log(`Current Implementation: ${currentImpl}`);

    const txResp = await factory.connect(deployer).upgradeImplementation(newImplAddr);
    const txReceipt = await txResp.wait();

    console.log(">>> ")
    console.log("Implementation upgraded successfully!");
    console.log(`Transaction Hash: ${txReceipt?.hash}`);
    
    const proxyAddr = await factory.getProxy();
    console.log(`Proxy Address (unchanged): ${proxyAddr}`);
}