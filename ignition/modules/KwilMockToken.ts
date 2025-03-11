import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KwilMockTokenModule", (m) => {
    const mockToken = m.contract("KwilMockToken",
        [m.getParameter("owner")]);
    return {mockToken};
});
