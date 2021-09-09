import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { salt, pancakeTestnet } from "../utils"

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;
  const accounts = await hre.getUnnamedAccounts();

  console.log("Available accounts:", accounts);

  console.log("Deploying to", hre.network.name, "from", accounts[0]);

  const initialSupply = hre.ethers.utils.parseEther("100");
  const initialPrice = hre.ethers.utils.parseEther("0.01");
  const hexSalt = hre.ethers.utils.id(salt);

  console.log(
    `Initial supply=${initialSupply} ; Initial Price=${initialPrice} ; Salt=${salt}`
  );

  const deployedCore = await deploy("Core", {
    from: accounts[0],
    args: [
      accounts[0],
      initialSupply,
      initialPrice,
      pancakeTestnet,
    ],
    log: true,
    deterministicDeployment: hexSalt,
  });

  const deployedShares = await deploy("Shares", {
    from: accounts[0],
    args: [deployedCore.address],
    log: true,
    deterministicDeployment: hexSalt,
  });

  const deployedVestedShares = await deploy("VestedShares", {
    from: accounts[0],
    args: [deployedCore.address],
    log: true,
    deterministicDeployment: hexSalt,
  });

  const deployedSeats = await deploy("Seats", {
    from: accounts[0],
    args: [deployedCore.address, deployedShares.address],
    log: true,
    deterministicDeployment: hexSalt,
  });

  const core = (await hre.ethers.getContractAt("Core", deployedCore.address));
  await (await core.initialize(
    deployedShares.address,
    deployedVestedShares.address,
    deployedSeats.address
  )).wait();
};
export default deploy;
deploy.tags = ["Core"];
