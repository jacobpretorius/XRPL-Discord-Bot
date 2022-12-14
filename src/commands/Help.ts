import isAdmin from '../utils/isAdmin.js';
import { Message } from 'discord.js';
import { EventTypes, EventPayload } from '../events/BotEvents.js';

const help = async (message: Message) => {
  let reply = `You can
  - Link a wallet to your account using: 'linkwallet WALLETADDRESSHERE'
  - Check wallet points using: 'checkwallet WALLETADDRESSHERE'
  `;

  if (isAdmin(message.author.id)) {
    reply += `\nAdmin commands
    - Link a wallet to user account using: 'adminlinkwallet WALLETADDRESSHERE DISCORDUSER#NUMBER'
    - Delete a wallet from the system using: 'admindeletewallet WALLETADDRESSHERE'
    - Get all users in a role using: 'getroleusers ROLENAME'
    - Get a user's wallet address using: 'getwallet DISCORDUSER#NUMBER'
    - Get a wallet user by address using: 'getuser WALLETADDRESSHERE'
    `;
  }

  return message.reply(reply);
};

const eventCallback = async (payload: EventPayload) => {
  if (payload.handled) {
    return;
  }

  if (
    payload.messageLowered.includes('commands') ||
    payload.messageLowered.includes('help')
  ) {
    payload.handled = true;
    return await help(payload.message);
  }
};

export default class Help {
  public static setup(eventEmitter: any): void {
    eventEmitter.addListener(EventTypes.MESSAGE, eventCallback);
  }
}
