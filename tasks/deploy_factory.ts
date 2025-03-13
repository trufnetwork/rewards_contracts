import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import RewardDistributorSingletonModule from "../ignition/modules/RewardDistributorSingleton";
import RewardDistributorFactoryModule from "../ignition/modules/RewardDistributorFactory";
import {task} from "hardhat/config";


task("deploy-factory",
    "Deploy singleton and factory contracts")
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await deployFactory(hre, deployer);
        }
    );

/**
 * Deploys the RewardDistributor Singleton and Factory contracts using the Ignition deployment framework.
 *
 * @param {HardhatRuntimeEnvironment} hre - The Hardhat runtime environment used to access Ignition deployment utilities and modules.
 * @param {HardhatEthersSigner} deployer - The signer object used as the default sender for deploying contracts.
 */
async function deployFactory(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner) {
    console.log('Deployer/Owner address: ', deployer.address);

    const { singleton } = await hre.ignition.deploy(RewardDistributorSingletonModule, {
        defaultSender: deployer.address,
        config: {
            requiredConfirmations: 1,
        },
        parameters: {
            RewardDistributorSingletonModule: {
                owner: deployer.address,
            },
        },
    });

    console.log(">>> ")
    console.log(`Singleton contract deployed to: ${await singleton.getAddress()}`);

    const {factory} = await hre.ignition.deploy(RewardDistributorFactoryModule, {
        config: {
            requiredConfirmations: 1,
        },
        defaultSender: deployer.address,
        parameters: {
            RewardDistributorFactoryModule: {
                imp: await singleton.getAddress(),
                owner: deployer.address,
            },
        },
    })

    console.log(`Factory Contract deployed to: ${await factory.getAddress()}`);
}
