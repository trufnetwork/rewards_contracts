import {task, types} from "hardhat/config";
import {
    SafeAccountConfig,
    getSafeAddressFromDeploymentTx,
    ContractNetworksConfig,
    predictSafeAddress,
    SafeProvider, SafeDeploymentConfig
} from '@safe-global/protocol-kit'
import Safe from '@safe-global/protocol-kit';
import {getChainSpecificDeployerSaltNonce} from "../peripheral/lib/reward";
import {toBigInt} from "ethers";

const fs = require('fs');

interface localDeployedSafe {
    address: string;
    abi: any[];
}

function getLocalDeployments(network: string, deploymentFile: string): Record<string, localDeployedSafe> {
    try {
        const data = fs.readFileSync(deploymentFile, 'utf-8');
        const deployed = JSON.parse(data);


        const customNetwork = deployed[network].find((deployment: { name: string }) => deployment.name === 'custom');
        if (customNetwork) {
            console.log("Custom Network Deployment Found");
            return customNetwork["contracts"];
        } else {
            console.log("No 'custom' network deployment found for this network.");
            return {};
        }

    } catch (e) {
        console.error("Failed to read or parse deployment file:", e.message);
        return {};
    }
}


task("deploy-safe", "Deploy a safe contract")
    .addPositionalParam("threshold", "Threshold of the safe", undefined, types.int)
    .addOptionalParam("safeVersion", "Safe version", "1.4.1", types.string)
    .addVariadicPositionalParam("owners", "Owners of the safe", undefined, types.string)
    .addOptionalParam("deployments", "the safe deployments info file path; you can get his from safe-smart-account repo, run `npx hardhat export --export-all custom`", undefined, types.string)
    .setAction(
    async(taskArgs, hre)=> {
        let chainId = hre.network.config.chainId ?? 31337;
        console.log(`Current network: ${hre.network.name}/${chainId}`)
        console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

        let deployed: Record<string, localDeployedSafe> = {};
        let contractNetworks: ContractNetworksConfig | undefined;

        if (chainId.toString() === "31337") { // use local deployment from taskArgs.deployments
            if (!taskArgs.deployments) {
                console.log("'--deployments' is not configured")
                return;
            }

            deployed = getLocalDeployments(chainId.toString(), taskArgs.deployments);

            // https://docs.safe.global/sdk-protocol-kit/reference/safe-factory
            contractNetworks = {
                [chainId.toString()] : {
                    safeSingletonAddress: deployed['Safe']["address"],
                    safeProxyFactoryAddress: deployed['SafeProxyFactory']["address"],
                    multiSendAddress: deployed['MultiSend']["address"],
                    multiSendCallOnlyAddress: deployed['MultiSendCallOnly']["address"],
                    fallbackHandlerAddress: deployed['CompatibilityFallbackHandler']["address"],
                    signMessageLibAddress: deployed['SignMessageLib']["address"],
                    createCallAddress: deployed['CreateCall']["address"],
                    simulateTxAccessorAddress: deployed['SimulateTxAccessor']["address"],
                }
            } as ContractNetworksConfig

            console.log("Local safe deployments: ", contractNetworks);
        }

        if (!("url" in hre.network.config)) {
            console.log("network provider url is not configured")
            return;
        }

        if (taskArgs.owners.length < 1) {
            console.log("Owners must have at least 1 addresses")
            return;
        }

        if (taskArgs.threshold > taskArgs.owners.length) {
            console.log("Threshold must be less than or equal to the number of owners")
            return;
        }

        if (taskArgs.threshold < 1) {
            console.log("Threshold must be greater than 0")
            return;
        }

        console.log(">>>")
        console.log("Owners: ", taskArgs.owners)
        console.log("Threshold: ", taskArgs.threshold)
        console.log("Safe Version: ", taskArgs.safeVersion)

        const provider = hre.network.config.url;
        const [deployer] = await hre.ethers.getSigners();
        const safeProvider = new SafeProvider({ provider:provider, signer:deployer.address })

        const deployerNonce = await deployer.getNonce()
        const deploySaltNonce = getChainSpecificDeployerSaltNonce(chainId.toString(),
            deployer.address,
            deployerNonce.toString());

        const safeAccountConfig: SafeAccountConfig = {
            owners: taskArgs.owners,
            threshold: taskArgs.threshold,
        }

        const safeDeploymentConfig: SafeDeploymentConfig = {
            safeVersion: taskArgs.safeVersion, // optional parameter
            saltNonce: deploySaltNonce, // optional parameter
        }

        const predictSafe = {
            safeAccountConfig,
            safeDeploymentConfig
        }

        const safeProto = await Safe.init({ provider: provider,
            // isL1SafeSingleton:
            signer: deployer.address, predictedSafe: predictSafe, contractNetworks: contractNetworks })

        const deploymentTransaction = await safeProto.createSafeDeploymentTransaction()

        const predicatedSafeAddress = await predictSafeAddress({
            safeProvider: safeProvider,
            chainId: toBigInt(chainId.toString()),
            safeAccountConfig: safeAccountConfig,
            safeDeploymentConfig: safeDeploymentConfig,
            // isL1SafeSingleton:
            customContracts: contractNetworks ? contractNetworks[chainId.toString()]: undefined,
        })

        console.log("Predicted Safe Address: ", predicatedSafeAddress);

        // https://github.com/safe-global/safe-core-sdk/blob/main/guides/integrating-the-safe-core-sdk.md
        const txResp = await deployer.sendTransaction({
            to: deploymentTransaction.to,
            data: deploymentTransaction.data
        })

        console.log(">>>")
        console.log('Transaction hash:', txResp.hash)

        const txReceipt = await txResp.wait()
        // // Extract the Safe address from the deployment transaction receipt; this only works if l2SafeSingleton
        // const safeAddress = getSafeAddressFromDeploymentTx(txReceipt, taskArgs.safeVersion)
        // console.log('safeAddress from event:', safeAddress)

        const deployedSafe = await Safe.init({
            provider: provider,
            safeAddress: predicatedSafeAddress,
            contractNetworks: contractNetworks
        })

        console.log('Is Safe deployed:', await deployedSafe.isSafeDeployed())
        console.log('Safe Address:', await deployedSafe.getAddress())
        console.log('Safe Owners:', await deployedSafe.getOwners())
        console.log('Safe Threshold:', await deployedSafe.getThreshold())
    })
