import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const KwilMockTokenModule = buildModule("KwilMockToken", (m) => {
    const mockToken = m.contract("KwilMockToken", [m.getParameter("owner")]);

    return {mockToken};
});

export default KwilMockTokenModule;
