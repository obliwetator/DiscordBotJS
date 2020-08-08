import { token } from './Config'
import DB from './DB/DB'
import { Client, GuildChannel, TextChannel, Collection, ChannelManager, Channel, VoiceChannel } from 'discord.js'
import WebSocket from 'ws';
import { server } from './WebSocketServer/Server'

server;

const database: DB = new DB()
const client = new Client();


const ws = new WebSocket('wss://patrykstyla.com:8080');


ws.on('open', () => {
    ws.send('Bot socket is ready');
});

// ws.on('message', function incoming(data) {
//     console.log('Bot received: %s', data);
// });

client.on('ready', async () => {

    // const channel = client.channels.cache.get("dfs")!
    // if (channel.type == "voice") {

    // }

    // First time connecting
    // client.guilds.cache.firstKey() returns the channel ID which we are querying
    let GuildKey = client.guilds.cache.firstKey();
    database.GuildId = GuildKey!;
    if (await database.FirstTimeInGuild(GuildKey!)) {
        database.AddGuild(client.guilds.cache.first()!, client.channels.cache as Collection<string, TextChannel>);
    }
    // Check if the chanels match up since last login
    let channels = await database.GetChannels(GuildKey!);
    let ChannelsToAdd: Channel[] = [];
    client.channels.cache.forEach((element, key) => {
        if (!channels.has(key)) {
            // We don't have that channel added. Add it
            ChannelsToAdd.push(element);
            console.log('FALSE')
        }
    });
    if (ChannelsToAdd.length > 0) {
        database.AddChannels(ChannelsToAdd);    
    }
    // Update ALL channels when connecting to a server
    if (Object.keys(client.channels.cache).length > 0) {
        database.UpdateAllChannels(client.channels);
    }
    database.AddLog(`Logged in as ${client.user!.tag}!`)
    // database.AddChannels(client.channels)
    // console.log('on ready',   client.guilds.cache.firstKey())
});

client.on('channelCreate', (channel) => {
    if (channel.type == 'text') {
        let TextChannel = channel as TextChannel
        database.AddChannels([TextChannel])
        database.AddLog(`Text Channel Created:  ${TextChannel.name}`)
    }
})

client.on('channelDelete', (channel) => {
    if (channel.type == 'text') {
        let TextChannel = channel as TextChannel
        database.RemoveTable(TextChannel)
        database.AddLog(`Text Channel Deleted:  ${TextChannel.name}`)
    }
})

client.on('userUpdate', (oldUser, newUser) => {
    console.group()
    console.log('user', oldUser)
    console.log('a', newUser)
    console.groupEnd()
})

client.on("guildUpdate", (oldGuild, newGuild) => {
    console.error(`a guild is updated`);
});

client.on("guildUnavailable", (guild) => {
    console.error(`a guild becomes unavailable, likely due to a server outage: ${guild}`);
});

client.on("guildMemberUpdate",(oldMember, newMember) => {
    console.error(`a guild member changes - i.e. new role, removed role, nickname.`);
});

client.on("guildMemberRemove", (member) => {
    console.log(`a member leaves a guild, or is kicked: ${member.id}`);
});

client.on("guildMemberAdd", (member) => {
    console.log(`a user joins a guild: ${member.id}`);
});

client.on('message', (msg) => {
    // send the message to all clients
    ws.send(msg.content)
    // console.log('Raw message', msg)
    if (msg.channel.type == "text") {
        database.AddMessage(msg, msg.channel)
    }
});

client.login(token);