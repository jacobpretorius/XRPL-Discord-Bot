import getWalletAddress from '../utils/getWalletAddress.js';
import { getWalletHoldings } from '../integration/xrpl/getWalletHoldings.js';
import { updateUserWallet } from '../data/updateUserWallet.js';
import { updateUserRoles } from '../integration/discord/updateUserRoles.js';
import { Client, User, MessagePayload, MessageOptions } from 'discord.js';
import truncate from '../utils/truncate.js';
import { WalletUpdateResponse } from '../models/enum/WalletUpdateResponse.js';
import { EventTypes, EventPayload } from '../events/BotEvents.js';
import signIn from '../integration/xumm/signIn.js';
import SETTINGS from '../settings.js';

const linkWallet = async (
  message: string,
  user: User,
  client: Client,
  LOGGER: any
): Promise<string> => {
  if (SETTINGS.XUMM.ENABLED) {
    const loginResponse = await signIn(user.id);
    if (loginResponse.signInQrUrl) {
      return loginResponse.signInQrUrl;
    }

    return null;
  } else {
    // TODO make this nice by using a shared function

    // Get their address
    const walletAddress = getWalletAddress(message);

    if (!walletAddress) {
      return `Could not get your wallet address, please check the format and try again for example '/linkwallet WALLETADDRESSHERE'`;
    }

    // Get holdings
    let holdings = await getWalletHoldings(walletAddress, null);
    if (holdings === -1) {
      if (LOGGER !== null) {
        LOGGER.trackEvent({
          name: 'linkWallet-no-trustline',
          properties: { walletAddress },
        });
      }

      return `Seems like you don't have the project trustline yet, please retry once it has been added 👉 https://xrpscan.com/account/${walletAddress}`;
    }

    // Allow them to set it even with network error
    let hadError = false;
    if (holdings === null) {
      hadError = true;
      holdings = 0;
    }

    const newWallet: IWallet = {
      address: walletAddress,
      points: holdings,
      verified: false, // todo when we have XUMM integration
    };

    const newUser: IBotUser = {
      discordId: user.id,
      discordUsername: user.username,
      discordDiscriminator: user.discriminator,
      previousDiscordUsername: '',
      previousDiscordDiscriminator: '',
      totalPoints: holdings,
      wallets: [],
    };

    // Save in Mongo
    const mongoUpdateResult = await updateUserWallet(newUser, newWallet, false);

    // The wallet has been claimed before, needs to be set by admin
    if (mongoUpdateResult === WalletUpdateResponse.ErrorAddressAlreadyClaimed) {
      if (LOGGER !== null) {
        LOGGER.trackEvent({
          name: 'linkWallet-claimed-by-another-user',
          properties: {
            walletAddress,
            activeUserId: user.id,
            activeUserName: user.username,
          },
        });
      }

      return `This address has been claimed before, if it wasn't done by you please message a mod with ownership proof to claim it`;
    }

    // If the user has set too many addresses an admin has to do it
    if (mongoUpdateResult === WalletUpdateResponse.ErrorTooManyAccountClaims) {
      if (LOGGER !== null) {
        LOGGER.trackEvent({
          name: 'linkWallet-too-many-claimed',
          properties: {
            walletAddress,
            activeUserId: user.id,
            activeUserName: user.username,
          },
        });
      }
      return `You seem to have claimed too many addresses, please message a mod with ownership proof to claim more`;
    }

    // Set role
    await updateUserRoles(0, holdings, user.id, client, LOGGER, false);

    if (LOGGER !== null) {
      LOGGER.trackEvent({
        name: 'linkWallet-success',
        properties: {
          walletAddress,
          activeUserId: user.id,
          activeUserName: user.username,
        },
      });
    }

    // Send confirmation to the user
    if (hadError) {
      return `Wallet linked! There was an error trying to get your holdings from the XRPL network. Your role will be updated automatically once the network is working. You do not need to do anything else.`;
    }

    return `Found your ${truncate(
      holdings,
      2
    )} points! Updated server roles set 🚀`;
  }
};

const eventCallbackOnMessage = async (payload: EventPayload) => {
  if (payload.handled) {
    return;
  }

  if (
    payload.messageLowered.includes('link wallet') ||
    payload.messageLowered.includes('linkwallet')
  ) {
    payload.handled = true;

    const result = await linkWallet(
      payload.message.content,
      payload.message.author,
      payload.client,
      payload.logger
    );

    // Standard text based flow
    if (!SETTINGS.XUMM.ENABLED) {
      return payload.message.reply(result);
    }

    // Error with xumm setup
    if (result === null) {
      return payload.message.reply(
        'Error connecting to xumm, please try again later.'
      );
    }

    // We have a QR code url to return for the xumm login
    const options: MessageOptions = {
      content: 'Scan the QR code using your xumm wallet',
      embeds: [
        {
          image: {
            url: result,
          },
        },
      ],
      reply: { messageReference: payload.message },
    };
    const replyPayload = new MessagePayload(payload.message, options);
    return payload.message.reply(replyPayload);
  }
};

const eventCallbackOnInteraction = async (payload: EventPayload) => {
  if (payload.handled) {
    return;
  }

  if (payload.interaction.commandName === 'linkwallet') {
    payload.handled = true;

    await payload.interaction.reply({
      content: await linkWallet(
        payload.interaction.options.getString('wallet-address'),
        payload.interaction.user,
        payload.client,
        payload.logger
      ),
      ephemeral: true,
    });
    return;
  }
};

export default class LinkWallet {
  public static setup(eventEmitter: any): void {
    eventEmitter.addListener(EventTypes.MESSAGE, eventCallbackOnMessage);

    eventEmitter.addListener(
      EventTypes.INTERACTION,
      eventCallbackOnInteraction
    );
  }
}
