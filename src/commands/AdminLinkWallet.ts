import getWalletAddress from '../utils/getWalletAddress.js';
import getUserNameFromAdminLinkWalletCommand from '../utils/getUserNameFromAdminLinkWalletCommand.js';
import isAdmin from '../utils/isAdmin.js';
import { getWalletHoldings } from '../integration/xrpl/getWalletHoldings.js';
import { getUserAccountIdByUsername } from '../integration/discord/getUserAccountIdByUsername.js';
import { updateUserWallet } from '../data/updateUserWallet.js';
import { updateUserRoles } from '../integration/discord/updateUserRoles.js';
import { Client, Message } from 'discord.js';
import { EventTypes, EventPayload } from '../events/BotEvents.js';

const adminLinkWallet = async (message: Message, client: Client) => {
  if (!isAdmin(message.author.id)) {
    return message.reply(`Sorry you are not autorised to do that.`);
  }

  // Get address
  const walletAddress = getWalletAddress(message.content);

  if (!walletAddress) {
    return message.reply(
      `Could not get their wallet address, please check the format and try again for example 'linkwallet WALLETADDRESSHERE'`
    );
  }

  const holdings = await getWalletHoldings(walletAddress, null);

  // Get user details
  const messageParsed = getUserNameFromAdminLinkWalletCommand(
    message.content,
    walletAddress
  );
  const userAccountId = await getUserAccountIdByUsername(
    messageParsed.username,
    messageParsed.tag,
    client
  );

  const newWallet: IWallet = {
    address: walletAddress,
    points: holdings,
    verified: false,
  };

  const newUser: IBotUser = {
    discordId: userAccountId,
    discordUsername: messageParsed.username,
    discordDiscriminator: messageParsed.tag,
    previousDiscordUsername: '',
    previousDiscordDiscriminator: '',
    totalPoints: holdings,
    wallets: [],
  };

  // Save in Mongo
  const mongoUpdateResult = await updateUserWallet(newUser, newWallet, false);

  // Set role
  await updateUserRoles(0, holdings, userAccountId, client, null, false);

  // Send confirmation to the user
  return message.reply(`I see their ${holdings} points admin! Linked ????`);
};

const eventCallback = async (payload: EventPayload) => {
  if (payload.handled) {
    return;
  }

  if (
    payload.messageLowered.includes('admin link wallet') ||
    payload.messageLowered.includes('adminlinkwallet')
  ) {
    payload.handled = true;
    return await adminLinkWallet(payload.message, payload.client);
  }
};

export default class AdminLinkWallet {
  public static setup(eventEmitter: any): void {
    eventEmitter.addListener(EventTypes.MESSAGE, eventCallback);
  }
}
