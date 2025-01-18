import {NodeKwil, Utils} from "../../../../work/kwil-js/dist";


async function main() {
    const kwil = new NodeKwil({kwilProvider: "http://localhost:8484", chainId: "kwil-testnet"});
    console.log("------",await kwil.ping());

    const callBody = {
        dbid: "y_rewards",
        name: "latest_finalized",
        inputs: [{a: 1}]
    }
    const res = await kwil.call(callBody);
    console.log("====", res);
}

main().catch(console.error)