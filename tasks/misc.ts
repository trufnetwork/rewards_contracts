import {task, types} from "hardhat/config";
import KwilMockTokenModule from "../ignition/modules/KwilMockToken";
import dotenv from "dotenv";
import {parseUnits} from "ethers";

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