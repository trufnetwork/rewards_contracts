import {task, types} from "hardhat/config";
import KwilMockTokenModule from "../ignition/modules/KwilMockToken";
import dotenv from "dotenv";
import {parseUnits} from "ethers";
import hre from "hardhat";
import {HardhatNetworkHDAccountsConfig} from "hardhat/src/types/config";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {HardhatRuntimeEnvironment} from "hardhat/types";

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

task("transfer-token", "Transfer mock token to a given address")
    .addPositionalParam("tokenAddr", "address of the token to transfer", undefined, types.string)
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
                     proofsStr: string,
                     txValue: string = "0.02") {
    // convert to hex if they're not HEX (base64)
    if (!kwilBlockHash.startsWith("0x")) {
        kwilBlockHash = base64ToHex(kwilBlockHash);
    }
    if (!treeRoot.startsWith("0x")) {
        treeRoot = base64ToHex(treeRoot);
    }
    const proofs = proofsStr.split(",").map(proof => proof.startsWith("0x") ? proof : base64ToHex(proof));

    const rd = await hre.ethers.getContractAt("RewardDistributor", rewardAddress);
    const rewardTokenAddress = await rd.rewardToken();
    const rewardToken = await hre.ethers.getContractAt("ERC20", rewardTokenAddress);
    const txResp = await rd.connect(claimer).claimReward(recipient, rewardAmount, kwilBlockHash, treeRoot, proofs,
        {value: hre.ethers.parseUnits(txValue, "ether")})
    console.log("txResp: ", txResp);

    const txReceipt = await txResp.wait();
    console.log("txReceipt: ", txReceipt);
}

task ("claim-rewards", "Claim rewards from the escrow contract")
    .addPositionalParam("escrow", "address of the escrow(reward distributor)", undefined, types.string)
    .addPositionalParam("recipient", "address of the recipient", undefined, types.string)
    .addPositionalParam("amount", "amount of reward to claim", undefined, types.string)
    .addPositionalParam("kwilBlockHash", "hash of the kwil block; base64 or hex(with 0x)", undefined, types.string)
    .addPositionalParam("rewardRoot", "reward merkle tree root; base64 or hex(with 0x)", undefined, types.string)
    .addPositionalParam("proofs", "merkle tree proofs;base64 or hex(with 0x); comma separated", undefined, types.string)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())


            if (hre.network.name != "sepolia") {
                console.log("Skip test on network: " + hre.network.name);
                return;
            }

            let actConfig: HardhatNetworkHDAccountsConfig = hre.network.config.accounts as HardhatNetworkHDAccountsConfig;
            console.log("current block: ", await hre.ethers.provider.getBlockNumber())

            // as long as the signer has Sepolia ETH
            const claimer = (await hre.ethers.getSigners())[0];

            // address recipient, uint256 amount, bytes32 kwilBlockHash, bytes32 rewardRoot, bytes32[] calldata proofs
            await claim(hre,
                claimer,
                taskArgs.escrow,
                taskArgs.recipient,
                taskArgs.amount,
                taskArgs.kwilBlockHash,
                taskArgs.rewardRoot,
                taskArgs.proofs
                );
        })