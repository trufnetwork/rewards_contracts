import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const KwilMockTokenModule = buildModule("KwilMockTokenModule", (m) => {
    const mockToken = m.contract("KwilMockToken", ["0x5409ED021D9299bf6814279A6A1411A7e866A631"]);

    return {mockToken};
});

export default KwilMockTokenModule;
