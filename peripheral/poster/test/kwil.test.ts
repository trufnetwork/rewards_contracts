import {Kwil} from "../kwil";

async function main() {
    const kwil = new Kwil("http://localhost:8484", "kwil-testnet", "y_rewards");
    const rewards = await kwil.fetchRewardRequests(1000000, 10);
    console.log("====", rewards);
}

main().catch(console.error)