import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const KwilMockTokenModule = buildModule("KwilMockToken", (m) => {
    const deployer = m.getAccount(0);
    const mockToken = m.contract("KwilMockToken",
        [m.getParameter("owner")],
        {from: deployer});

    return {mockToken};
});

export default KwilMockTokenModule;
