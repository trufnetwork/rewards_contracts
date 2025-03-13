import hre from "hardhat";
import dotenv from 'dotenv';
dotenv.config();


async function main() {
    let chainId = hre.network.config.chainId ?? 31337;
    console.log(`Current network: ${hre.network.name}/${chainId}`)
    console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

    const fromBlock = await hre.ethers.provider.getBlockNumber() - 1000000;
    console.log("FromBlock: ", fromBlock)

    const deployed = require(`../ignition/deployments/chain-${chainId.toString()}/deployed_addresses.json`);
    let deployedFactory: string = deployed["RewardDistributorFactoryModule#RewardDistributorFactory"];

    const factory= await hre.ethers.getContractAt("RewardDistributorFactory", deployedFactory);

    console.log(">>> ")
    // query history deployments
    const events = await factory.queryFilter(factory.filters.Created, fromBlock)
    events.forEach(e => {
        console.log(`Create ${e.args[0]} at ${e.blockNumber}`);
    })
}

main().catch(console.error)