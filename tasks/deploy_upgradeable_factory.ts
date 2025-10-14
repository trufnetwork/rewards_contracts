import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task} from "hardhat/config";

task("deploy-upgradeable-factory",
    "Deploy upgradeable implementation and factory contracts")
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await deployUpgradeableFactory(hre, deployer);
        }
    );

/**
 * Deploys the upgradeable RewardDistributor implementation and Factory contracts.
 *
 * @param {HardhatRuntimeEnvironment} hre - The Hardhat runtime environment
 * @param {HardhatEthersSigner} deployer - The signer object used as the default sender for deploying contracts.
 */
async function deployUpgradeableFactory(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner) {
    console.log('Deployer/Owner address: ', deployer.address);

    try {
      // 1. Deploy implementation contract
      const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
      const implementation = await RewardDistributor.deploy();
      await implementation.waitForDeployment();
      const implAddress = await implementation.getAddress();
      console.log(`Implementation contract deployed to: ${implAddress}`);
      
      // Verify the implementation has code
      const code = await hre.ethers.provider.getCode(implAddress);
      if (code === '0x') {
          throw new Error("Implementation deployment failed - no code at address");
      }

      // 2. Deploy factory contract  
      console.log("Deploying RewardDistributorFactory...");
      const Factory = await hre.ethers.getContractFactory("RewardDistributorFactory");
      const factory = await Factory.deploy(deployer.address, implAddress);
      await factory.waitForDeployment();
      const factoryAddress = await factory.getAddress();
      console.log(`Factory contract deployed to: ${factoryAddress}`);

      console.log(">>> ")
      console.log("Deployment completed!");
      console.log(`Implementation: ${implAddress}`);
      console.log(`Factory: ${factoryAddress}`);
      
      // Save addresses for reference
      const deploymentInfo = {
          implementation: implAddress,
          factory: factoryAddress,
          deployer: deployer.address,
          network: hre.network.name,
          chainId: hre.network.config.chainId,
          deployedAt: new Date().toISOString()
      };
      
      console.log(">>> ")
      console.log("Save these addresses for future reference:");
      console.log(JSON.stringify(deploymentInfo, null, 2));
    } catch (error) {
      console.error("Failed to deploy implementation:", error);
      throw error;
    }
}