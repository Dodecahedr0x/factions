import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import assertRevert from "./helpers/assertRevert";
import increaseTime from "./helpers/increaseTime";

const rarityAddress = "0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb";
const rarityAttributesAddress = "0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1";
const raritySkillsAddress = "0x6292f3fB422e393342f257857e744d43b1Ae7e70";
const codexSkillsAddress = "0x67ae39a2Ee91D7258a86CD901B17527e19E493B3";

describe("Factions", async function () {
  let accounts: Signer[];
  const faction1 = 1;
  const faction2 = 2;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it("Should send names", async function () {
    const Factions = await ethers.getContractFactory("Factions");

    const factions = await Factions.deploy();
    await factions.deployed();

    expect(await factions.factionName(1)).to.equal("The Harpers");
    expect(await factions.factionName(2)).to.equal("The Order of the Gauntlet");
    expect(await factions.factionName(3)).to.equal("The Emerald Enclave");
    expect(await factions.factionName(4)).to.equal("The Lords' Alliance");
    expect(await factions.factionName(5)).to.equal("The Zhentarim");
  });

  it("Should update settings", async function () {
    const Factions = await ethers.getContractFactory("Factions");

    const factions = await Factions.deploy();
    await factions.deployed();

    const oldFactionChangeDelay = await factions.factionChangeDelay();
    await factions.setFactionChangeDelay(oldFactionChangeDelay.mul(2));
    expect(await factions.factionChangeDelay()).to.equal(
      oldFactionChangeDelay.mul(2)
    );
    await assertRevert(factions.connect(accounts[1]).setFactionChangeDelay());

    const newOwner = await accounts[1].getAddress();
    await factions.setOwner(newOwner);
    expect(await factions.owner()).to.equal(newOwner);
    await assertRevert(factions.setOwner());
  });

  it("Should enroll created summoners", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("IRarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "IRarityAttributes",
      rarityAttributesAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    // Summon a barbarian
    const result = await (await rarity.summon(1)).wait();
    const summoner = ethers.BigNumber.from(result.events[0].topics[3]);

    await assertRevert(factions.enroll(summoner, faction1));

    await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);

    await factions.enroll(summoner, faction1);
    expect(await factions.enrolled(faction1)).to.equal(1);

    await assertRevert(factions.enroll(summoner, faction2));

    const switchDelay = (await factions.factionChangeDelay()).toNumber();
    await increaseTime(switchDelay);

    await factions.enroll(summoner, faction2);
    expect(await factions.enrolled(faction1)).to.equal(0);
    expect(await factions.enrolled(faction2)).to.equal(1);
  });
});
