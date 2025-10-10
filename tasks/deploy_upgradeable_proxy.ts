import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {parseUnits} from "ethers";
import {task, types} from "hardhat/config";
import {getChainSpecificDeployerSaltNonce} from "../peripheral/lib/reward";

task("deploy-upgradeable-proxy",
    "Deploy an upgradeable proxy contract using the factory")
    .addOptionalParam("posterFee", "poster fee in Ether", "0.0001", types.string)
    .addOptionalParam("factory", "factory contract address", "", types.string)
    .addOptionalParam("implementation", "implementation contract address", "", types.string)
    .addPositionalParam("safe", "safe wallet contract address", undefined, types.string, false)
    .addPositionalParam("escrowToken", "erc20 token address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            if (!taskArgs.factory) {
                console.log("Error: factory address is required. Use --factory <address>");
                return;
            }

            const [deployer] = await hre.ethers.getSigners();
            const deployerNonce = await deployer.getNonce()
            const saltNonce = getChainSpecificDeployerSaltNonce(chainId.toString(),
                deployer.address,
                deployerNonce.toString());

            await deployProxy(hre, deployer, taskArgs.factory,
                taskArgs.safe, taskArgs.posterFee, taskArgs.escrowToken, saltNonce);
        }
    );

async function deployProxy(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner, factoryAddr: string,
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
    const factory = await hre.ethers.getContractAt("RewardDistributorFactory", factoryAddr);

    // Predict proxy address using REAL parameters
    const predictAddr = await factory.predicateAddr(safeAddr, parseUnits(initFee, "ether"), tokenAddr, saltNonce);
    console.log(`Predicted Proxy Address: ${predictAddr}`);

    // Deploy proxy
    const txResp = await factory.connect(deployer).create(
        safeAddr, parseUnits(initFee, "ether"), tokenAddr, saltNonce)
    
    console.log(`Transaction hash: ${txResp.hash}`);
    const txReceipt = await txResp.wait();
    console.log(`Transaction confirmed in block: ${txReceipt!.blockNumber}`);

    // Get the ACTUAL deployed address from the Created event
    const createdEvent = txReceipt!.logs.find(log => {
        try {
            const parsed = factory.interface.parseLog({topics: log.topics as string[], data: log.data});
            return parsed?.name === 'Created';
        } catch {
            return false;
        }
    });
    
    if (!createdEvent) {
        throw new Error("Could not find Created event in transaction receipt");
    }
    
    const parsedEvent = factory.interface.parseLog({
        topics: createdEvent.topics as string[], 
        data: createdEvent.data
    });
    const actualProxyAddress = parsedEvent!.args[0];
    
    console.log(`ACTUAL Proxy Address: ${actualProxyAddress}`);
    if (actualProxyAddress.toLowerCase() === predictAddr.toLowerCase()) {
        console.log("✅ Predicted address matches actual deployed address!");
    } else {
        console.log("⚠️  WARNING: Predicted address differs from actual deployed address!");
        console.log("This indicates an issue with the predicateAddr function.");
    }

    // Get the deployed proxy contract using ACTUAL address
    const proxy = await hre.ethers.getContractAt("RewardDistributor", actualProxyAddress);

    console.log(">>> ")
    console.log("Upgradeable Proxy deployed to: ", await proxy.getAddress());
    console.log("Contract's safe: ", await proxy.safe());
    console.log("Contract's posterFee: ", await proxy.posterFee());
    console.log("Contract's rewardToken: ", await proxy.rewardToken());
    console.log("Contract's initial token balance: ", await token.balanceOf(proxy));
    
    console.log(">>> ")
    console.log("IMPORTANT: This is an upgradeable proxy!");
    console.log("- Proxy address will remain the same across upgrades");
    console.log("- Only the Safe wallet can authorize upgrades");
    console.log("- Use 'upgrade-proxy' task to upgrade implementation");
}