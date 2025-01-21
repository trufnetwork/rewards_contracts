import fs from "fs";

interface FinalizedReward {
    root: string;
    amount: string;
    signers: string[];
    signatures: string[];
    createdAt: number;
    safeNonce: number; // this is returned from Kwil
    leafCount?: number;
}

interface TxInfo {
    hash: string;
    fee: string;
    gasPrice: string;
    postBlock: number;
    includeBlock?: number;
    accountNonce: number;
}

interface RewardRecord {
    request: FinalizedReward;
    result?: TxInfo;
}

// Main State class
class State {
    private readonly path: string;
    lastBlock: number;
    rewards: RewardRecord[];
    pending: number[];
    index: Map<number, number>;

    constructor(path: string = '') {
        this.path = path;
        this.lastBlock = 0;
        this.rewards = [];
        this.pending = [];
        this.index = new Map();
    }

    // _sync is a private method that syncs the state to the file system
    private _sync() {
        if (!this.path) {
            return;
        }

        // Create a unique temporary file name using a timestamp and random string
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const tmpPath = `${this.path}.${timestamp}.${random}.tmp`;

        try {
            const data = {
                lastBlock: this.lastBlock,
                rewards: this.rewards,
                pending: this.pending
            };

            // Use synchronous write with fsync to ensure data is written to disk
            const fd = fs.openSync(tmpPath, 'wx', 0o600);
            try {
                fs.writeSync(fd, JSON.stringify(data, null, 2));
                fs.fsyncSync(fd);  // Force writing to disk
            } finally {
                fs.closeSync(fd);  // Ensure file descriptor is closed
            }

            // Atomic rename
            fs.renameSync(tmpPath, this.path);
        } catch (err) {
            // Clean up the temporary file if anything goes wrong
            fs.rmSync(tmpPath, {force: true});
            throw err;
        }
    }

    // Adds rewards to the state, also put them in the pending queue.
    async pendingRewardRecord(...rewards: FinalizedReward[]) {
        for (const reward of rewards) {
            this.rewards.push({ request: reward });
            this.index.set(reward.createdAt!, this.rewards.length - 1);
            this.pending.push(reward.createdAt!);
            this.lastBlock = reward.createdAt!;
        }

        this._sync();
    }

    // Adds rewards to the state, without put them in pending queue.
    async syncRewardRecord(...rewards: FinalizedReward[]) {
        for (const reward of rewards) {
            this.rewards.push({ request: reward });
            this.index.set(reward.createdAt!, this.rewards.length - 1);
            this.lastBlock = reward.createdAt!;
        }

        this._sync();
    }

    async updateResult(block: number, result: TxInfo) {
        const index = this.index.get(block);
        if (index === undefined) {
            throw new Error('Block not found');
        }

        this.rewards[index].result = result;

        if (result.includeBlock !== 0) {
            this.pending = this.pending.filter(b => b !== block);
        }

        this._sync();
    }

    async skipResult(block: number) {
        this.pending = this.pending.filter(b => b !== block);
        this._sync();
    }

    // Static method to load state from file
    static LoadStateFromFile(stateFile: string): State {
        const state = new State(stateFile);

        const data = fs.readFileSync(stateFile, 'utf8');
        if (data.length === 0) {
            return state;
        }

        const parsed = JSON.parse(data);

        state.lastBlock = parsed.lastBlock;

        if (parsed.rewards) {
            state.rewards = parsed.rewards;
        }

        if (parsed.pending) {
            state.pending = parsed.pending;
        }

        // Rebuild index from rewards
        for (let i = 0; i < state.rewards.length; i++) {
            const reward = state.rewards[i];
            if (reward.request!.createdAt !== undefined) {
                state.index.set(reward.request!.createdAt, i);
            }
        }

        return state;
    }
}

export {
    State,
    RewardRecord,
    FinalizedReward,
    TxInfo
}