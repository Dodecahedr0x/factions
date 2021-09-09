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

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it("Should enroll created summoners", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    // Summon a barbarian
    const result = await (await rarity.summon(1)).wait();
    const summoner = ethers.BigNumber.from(result.events[0].topics[3]);

    await assertRevert(factions.enroll(summoner, 0));

    await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);

    await factions.enroll(summoner, 0);
  });

  it("Should take ready summoners from the player", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

    let result = await (await rarity.summon(1)).wait();
    const summoner1 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner1, 17, 12, 17, 8, 8, 10);
    await factions.enroll(summoner1, 0);
    const skills1 = [
      0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner1, skills1);

    result = await (await rarity.summon(2)).wait();
    const summoner2 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner2, 17, 12, 17, 8, 10, 8);
    await factions.enroll(summoner2, 1);
    const skills2 = [
      3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner2, skills2);

    const initialBalance = (
      await rarity.balanceOf(accounts[0].getAddress())
    ).toNumber();
    const ownerAddress = await accounts[0].getAddress();

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyOneSummoner(summoner1, { value: TRIBUTE });
    expect(await rarity.ownerOf(summoner1)).to.equal(factions.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 1);

    await factions.retrieveOneSummoner(summoner1);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);

    await factions.readyManySummoner([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });
    expect(await rarity.ownerOf(summoner1)).to.equal(factions.address);
    expect(await rarity.ownerOf(summoner2)).to.equal(factions.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 2);

    await factions.retrieveManySummoner([summoner1, summoner2]);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.ownerOf(summoner2)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);
  });

  it("Should let summoners earn from their won clash", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

    let result = await (await rarity.summon(1)).wait();
    const summoner1 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner1, 17, 12, 17, 8, 8, 10);
    await factions.enroll(summoner1, 0);
    const skills1 = [
      0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner1, skills1);

    result = await (await rarity.summon(2)).wait();
    const summoner2 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner2, 17, 12, 17, 10, 8, 8);
    await factions.enroll(summoner2, 1);
    const skills2 = [
      3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner2, skills2);

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyManySummoner([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });

    await factions.startClash();

    const balanceBefore1 = await (
      await ethers.getSigner(factions.address)
    ).getBalance();
    await factions.receiveOneTributeShare(summoner1);
    expect(
      await (await ethers.getSigner(factions.address)).getBalance()
    ).to.equal(balanceBefore1.sub(TRIBUTE.mul(2)));

    await assertRevert(factions.startClash()); // Too early

    await increaseTime(60 * 60 * 24);

    await factions.retrieveManySummoner([summoner1, summoner2]);
    await factions.readyManySummoner([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });
    await factions.retrieveOneSummoner(summoner1); // Make sure faction 1 wins

    await factions.startClash();

    const balanceBefore2 = await (
      await ethers.getSigner(factions.address)
    ).getBalance();
    await factions.receiveOneTributeShare(summoner2);
    expect(
      await (await ethers.getSigner(factions.address)).getBalance()
    ).to.equal(balanceBefore2.sub(TRIBUTE.mul(2)));
  });
});
