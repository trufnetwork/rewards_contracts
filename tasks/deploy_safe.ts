import {task, types} from "hardhat/config";
import { SafeAccountConfig, getSafeAddressFromDeploymentTx} from '@safe-global/protocol-kit'
import Safe from '@safe-global/protocol-kit';

task("deploy-safe", "Deploy a safe contract")
    .addPositionalParam("threshold", "Threshold of the safe", undefined, types.int)
    .addOptionalParam("safeVersion", "Safe version", "1.4.1", types.string)
    .addVariadicPositionalParam("owners", "Owners of the safe", undefined, types.string)
    .setAction(
    async(taskArgs, hre)=> {
        let chainId = hre.network.config.chainId ?? 31337;
        console.log(`Current network: ${hre.network.name}/${chainId}`)
        console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

        if (chainId.toString() === "31337") {
            // TODO: need to provide local deployed safe info, SAFE sdk doesn't know our local deployment.
            // const contractNetworkCfg = ContractNetworksConfig{};
            console.log(`'${hre.network.name}' network is not supported yet`);
            return
        }

        let provider: string;

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

        provider = hre.network.config.url;
        const [deployer] = await hre.ethers.getSigners();

        const safeAccountConfig: SafeAccountConfig = {
            owners: taskArgs.owners,
            threshold: taskArgs.threshold,
        }

        const predictSafe = {
            safeAccountConfig,
            safeDeploymentConfig: {
                safeVersion: taskArgs.safeVersion, // optional parameter
                // saltNonce: , // optional parameter
            },
        }

        const safeProto = await Safe.init({ provider: provider, signer: deployer.address, predictedSafe: predictSafe })

        const deploymentTransaction = await safeProto.createSafeDeploymentTransaction()

        // Execute this transaction using the Ethereum client of your choice

        const txResp = await deployer.sendTransaction({
            to: deploymentTransaction.to,
            // value: BigInt(deploymentTransaction.value),
            data: deploymentTransaction.data
        })

        console.log(">>>")
        console.log('Transaction hash:', txResp.hash)

        const txReceipt = await txResp.wait()

        // Extract the Safe address from the deployment transaction receipt
        const safeAddress = getSafeAddressFromDeploymentTx(txReceipt, taskArgs.safeVersion)
        console.log('safeAddress from event:', safeAddress)

        const deployedSafe = await Safe.init({
            provider: provider,
            // signer: deployer.address,
            safeAddress: safeAddress,
        })

        console.log('Is Safe deployed:', await deployedSafe.isSafeDeployed())
        console.log('Safe Address:', await deployedSafe.getAddress())
        console.log('Safe Owners:', await deployedSafe.getOwners())
        console.log('Safe Threshold:', await deployedSafe.getThreshold())
    })
