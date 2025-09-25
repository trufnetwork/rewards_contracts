import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task} from "hardhat/config";

task("deploy-new-implementation",
    "Deploy a new RewardDistributor implementation contract")
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

    // Deploy new RewardDistributor implementation
    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const newImplementation = await RewardDistributor.deploy();
    await newImplementation.waitForDeployment();

    const newImplAddress = await newImplementation.getAddress();
    
    console.log(">>> ")
    console.log(`New RewardDistributor implementation deployed to: ${newImplAddress}`);
    console.log(`Use this address in the upgrade-implementation task`);

    return newImplAddress;
}