import hre from "hardhat";
import KwilMockToken from "../ignition/modules/KwilMockToken";
import {parseUnits} from "ethers";
import dotenv from 'dotenv';
import {getChainSpecificDefaultSaltNonce} from "../peripheral/lib/reward";
import deployedSepolia from "../ignition/deployments/chain-11155111/deployed_addresses.json";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";

dotenv.config();

async function deploy(chainID: number, deployer:HardhatEthersSigner, safeAddr: string, factoryAddr: string,  tokenAddr: string, initFee: string) {
    if (!safeAddr) {
        console.log("safe address is not configured")
        return;
    }

    if (tokenAddr == "") {
        console.log("reward token address is not configured")
        return;
    }

    const token = await hre.ethers.getContractAt("ERC20", tokenAddr);

    const factory= await hre.ethers.getContractAt("RewardDistributorFactory", factoryAddr);

    const predictAddr = await factory.predicateAddr(getChainSpecificDefaultSaltNonce(chainID));
    const txResp = await factory.connect(deployer).create(
        safeAddr, parseUnits(initFee, "ether"), tokenAddr, getChainSpecificDefaultSaltNonce(chainID))
    // console.log("txResp", txResp);
    const txRecipt = await txResp.wait();
    // console.log("txRecipt", txRecipt);

    const newRD = await hre.ethers.getContractAt("RewardDistributor", predictAddr);

    console.log("Contract", await newRD.getAddress());
    console.log("Contract's safe", await newRD.safe());
    console.log("Contract's posterFee", await newRD.posterFee());
    console.log("Contract's rewardToken", await newRD.rewardToken());
    console.log("Contract's initial token balance", await token.balanceOf(newRD));
}

async function main() {
    console.log("Current block height: ", await hre.ethers.provider.getBlockNumber())
    console.log("Current chainId: ", hre.network.config.chainId ?? "")
    console.log("Current network: ", hre.network.name)

    const safeAddr = "0x56D510E4782cDed87F8B93D260282776adEd3f4B";
    const rewardTokenAddr = "0x5e4ba745f8444bD1924d5467943C7b6375a09a47";
    const initFee = "0.001";

    const [deployer] = await hre.ethers.getSigners();

    switch (hre.network.config.chainId) {
        case 11155111: {

            const chainID = hre.network.config.chainId!;

            await deploy(chainID, deployer, safeAddr,
                deployedSepolia["RewardDistributorFactory#RewardDistributorFactory"],
                 rewardTokenAddr,
                initFee);
            break;
        }
        default: {
            // const rewardToken = await hre.ethers.getContractAt("ERC20", );
            console.log(`deploy to '${hre.network.name}' network is not supported yet`);
        }
    }
}

main().catch(console.error)