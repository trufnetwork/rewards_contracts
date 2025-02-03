import hre from "hardhat";
import dotenv from 'dotenv';
import {formatUnits, parseUnits} from "ethers";
dotenv.config();


async function info(addr: string) {
    console.log("0.04 ether", parseUnits("0.04", "ether"));

    const rd = await hre.ethers.getContractAt("RewardDistributor", addr);

    console.log(`RewardToken: ${await rd.rewardToken()}`)
    console.log(`PosterFee: ${formatUnits(await rd.posterFee(), "ether")} eth`);

}

async function main() {
    const addr = "0x528B94ff9218a7b5eaa6964b946172598F254E09";

    info(addr);
}

main().catch(console.error)