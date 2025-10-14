import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task} from "hardhat/config";

task("deploy-new-implementation",
    "Deploy a new RewardDistributor implementation for upgrades")
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await deployNewImplementation(hre, deployer);
        }
    );

async function deployNewImplementation(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner) {
    console.log('Deployer address: ', deployer.address);

    console.log(">>> ")
    console.log("Deploying new RewardDistributor implementation...");
    
    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const implementation = await RewardDistributor.deploy();
    await implementation.waitForDeployment();
    const implAddress = await implementation.getAddress();
    
    console.log(`New implementation deployed to: ${implAddress}`);

    console.log(">>> ")
    console.log("Implementation deployment completed!");
    console.log(`New Implementation Address: ${implAddress}`);
    
    const deploymentInfo = {
        implementation: implAddress,
        deployer: deployer.address,
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        deployedAt: new Date().toISOString()
    };
    
    console.log(">>> ")
    console.log("Save this address for upgrades:");
    console.log(JSON.stringify(deploymentInfo, null, 2));
    
    console.log(">>> ")
    console.log("Next steps:");
    console.log("1. Use this implementation address with 'generate-safe-upgrade-data'");
    console.log("2. Execute the upgrade transaction through your Safe wallet");
    console.log("3. Verify the upgrade with 'test-upgrade' or 'check-implementation'");
}