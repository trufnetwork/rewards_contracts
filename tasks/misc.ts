import {task, types} from "hardhat/config";
import KwilMockTokenModule from "../ignition/modules/KwilMockToken";
import dotenv from "dotenv";
import {formatUnits, parseUnits} from "ethers";
import hre from "hardhat";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import Safe from "@safe-global/protocol-kit";

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
                parameters: {
                    KwilMockTokenModule: {
                        owner: deployer.address,
                    },
                },
            });

            console.log(">>> ")
            console.log(`MockToken deployed: ${await mockToken.getAddress()}`);
        })

task("transfer-token", "Transfer mock token to a given address")
    .addPositionalParam("tokenAddr", "address of the Erc20 token to transfer from", undefined, types.string)
    .addPositionalParam("amount", "amount of token to transfer, in eth", undefined, types.string)
    .addPositionalParam("to", "recipient address to transfer token to", undefined, types.string)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            const token = await hre.ethers.getContractAt("ERC20", taskArgs.tokenAddr);
            const txResp = await token.connect(deployer).transfer(taskArgs.to, parseUnits(taskArgs.amount, "ether"));
            const txReceipt = await txResp.wait();
            console.log("Recipient's new token balance    ", await token.balanceOf(taskArgs.to));
        })

function base64ToHex(s: string): string {
    return '0x' + Buffer.from(s, 'base64').toString('hex')
}

async function claim(hre: HardhatRuntimeEnvironment,
                     claimer: HardhatEthersSigner,
                     rewardAddress: string,
                     recipient: string,
                     rewardAmount: string,
                     kwilBlockHash: string,
                     treeRoot: string,
                     proofs: string[],
                     txValue: string = "0.02") {
    const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
    const rewardTokenAddress = await rd.rewardToken();
    const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);

    console.log("current balance: ", formatUnits(await rewardToken.balanceOf(recipient), "ether"))

    const txResp = await rd.connect(claimer).claimReward(recipient, rewardAmount, kwilBlockHash, treeRoot, proofs,
        {value: hre.ethers.parseUnits(txValue, "ether")})
    console.log("txHash: ", txResp.hash);
    const txReceipt = await txResp.wait();
    console.log("new balance:     ", formatUnits( await rewardToken.balanceOf(recipient), "ether"))
}

task("claim-rewards", "Claim rewards from the escrow contract")
    .addPositionalParam("escrow", "address of the escrow(reward distributor)", undefined, types.string)
    .addPositionalParam("recipient", "address of the recipient", undefined, types.string)
    .addPositionalParam("amount", "amount of reward to claim", undefined, types.string)
    .addPositionalParam("kwilBlockHash", "hash of the kwil block; base64 or hex(starts with 0x)", undefined, types.string)
    .addPositionalParam("rewardRoot", "reward merkle tree root; base64 or hex(starts with 0x)", undefined, types.string)
    .addPositionalParam("proofs", "merkle tree proofs;base64 or hex(starts with 0x); comma separated; use '' for empty proofs", undefined, types.string)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            console.log("current block: ", await hre.ethers.provider.getBlockNumber())

            // as long as the signer has ETH
            const claimer = (await hre.ethers.getSigners())[0];

            let kwilBlockHash:string = taskArgs.kwilBlockHash;
            let rewardRoot:string = taskArgs.rewardRoot;

            // convert to hex if they're not HEX (base64)
            if (!kwilBlockHash.startsWith("0x")) {
                kwilBlockHash = base64ToHex(kwilBlockHash);
            }
            if (!rewardRoot.startsWith("0x")) {
                rewardRoot = base64ToHex(rewardRoot);
            }

            let proofs:string[] = []
            if (taskArgs.proofs.length !== 0) {
                proofs = taskArgs.proofs.split(",").map((proof: string) => proof.startsWith("0x") ? proof : base64ToHex(proof));
            }

            console.log(">>>")
            console.log("claimer address:   ", claimer.address);
            console.log("escrow address:    ", taskArgs.escrow);
            console.log("recipient address: ", taskArgs.recipient);
            console.log("amount:            ", formatUnits(taskArgs.amount, "ether"))
            console.log("kwilBlockHash:     ", kwilBlockHash);
            console.log("rewardRoot:        ", rewardRoot);
            console.log("proofs:            ", proofs);
            console.log(">>>")

            // address recipient, uint256 amount, bytes32 kwilBlockHash, bytes32 rewardRoot, bytes32[] calldata proofs
            await claim(hre, claimer, taskArgs.escrow,
                taskArgs.recipient,
                taskArgs.amount,
                kwilBlockHash,
                rewardRoot,
                proofs);
        })

task("show-escrow", "Show escrow contract info")
    .addPositionalParam("escrow", "address of the escrow(reward distributor)", undefined, types.string)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const rd = await hre.ethers.getContractAt("RewardDistributor", taskArgs.escrow);
            console.log(`PosterFee: ${formatUnits(await rd.posterFee(), "ether")} eth`)

            const tokenAddr = await rd.rewardToken();
            console.log(`RewardToken: ${tokenAddr}`)
            const token = await hre.ethers.getContractAt("ERC20", tokenAddr);
            console.log(`RewardToken Name: ${await token.name()}`)
            console.log(`RewardToken Symbol: ${await token.symbol()}`)
            console.log(`RewardToken Decimals: ${await token.decimals()}`)

            const safeAddress = await rd.safe();
            const provider = hre.network.config.url;
            const deployedSafe = await Safe.init({
                provider: provider,
                safeAddress: safeAddress,
                // contractNetworks: contractNetworks
            })

            console.log('Safe Address:', await deployedSafe.getAddress())
            console.log('Is Safe deployed:', await deployedSafe.isSafeDeployed())
            console.log('Safe Owners:', await deployedSafe.getOwners())
            console.log('Safe Threshold:', await deployedSafe.getThreshold())
        }
    )