import { token } from './Config'
import DB from './DB/DB'
import {Client, GuildChannel, TextChannel} from 'discord.js'

const database = new DB
const client = new Client();

client.on('ready', () => {
    console.log(`Logged in as ${client.user!.tag}!`);
});

client.on('channelCreate', channel => {
    if (channel.type == "text") {
        channel = (channel as TextChannel)
        console.log('Text Channel', TextChannel.name)
    }
    console.log(channel)
})

client.on('message', msg => {
    console.log((msg.channel as TextChannel).name + ": " + msg.content)
});



client.login(token);