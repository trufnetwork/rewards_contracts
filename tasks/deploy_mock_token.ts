import {task, types} from "hardhat/config";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import RewardDistributorSingletonModule from "../ignition/modules/RewardDistributorSingleton";
import RewardDistributorFactoryModule from "../ignition/modules/RewardDistributorFactory";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import KwilMockTokenModule from "../ignition/modules/KwilMockToken";
import {parseUnits} from "ethers";
import {getChainSpecificSaltNonce} from "../peripheral/lib/reward";
import dotenv from "dotenv";

// import { SafeAccountConfig, getSafeAddressFromDeploymentTx} from '@safe-global/protocol-kit'
// import Safe from '@safe-global/protocol-kit';
// import {ContractNetworksConfig} from "@safe-global/protocol-kit/dist/src/types/contracts";
dotenv.config();





task("deploy-mock-token","Deploy a mock ERC20 token named 'KMT'")
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())


            const [deployer] = await hre.ethers.getSigners();

            const {mockToken} = await hre.ignition.deploy(KwilMockTokenModule, {
                defaultSender: deployer.address,
                config: {
                    requiredConfirmations: 1,
                },
            });

            console.log(">>> ")
            console.log(`MockToken deployed: ${await mockToken.getAddress()}`);
        })


export {};