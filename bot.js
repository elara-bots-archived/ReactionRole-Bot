const {Client, WebhookClient} = require('discord.js'), config = require('./config'), cooldown = new Set();
if(config.roles.length === 0) {
    console.log(`You left the "roles" array empty in the config.js file... until you add roles to it.. the process will keep ending!`);
    return process.exit(1);
}
const Hook = async (hook, data) => {
    if(config.logging.enabled === false) return null;
    if(!hook) return null;
    if(typeof hook !== "string") return null;
    if(!data) return null;
    if(typeof data !== "object") return null;
    let h = hook.replace(/https:\/\/(discord|discordapp).com\/api\/webhooks\//, '').split("/");
    if(!h[0]) return null;
    if(!h[1]) return null;
    let Hook = new WebhookClient(h[0], h[1]);
    if(data.status === "Success"){
    Hook.send({embeds: [
        {
            color: data.type == "Added" ? 0xFF000 : 0xFF0000,
            title: `Reaction Role Logs`,
            fields: [
                {name: "Action", value: data.type, inline: false},
                {name: `User`, value: `\`@${data.user.tag}\` (${data.user.id})`, inline: false},
                {name: `Reaction`, value: `${data.emoji}`, inline: true},
                {name: `Role`, value: `${data.role} \`@${data.role.name}\` (${data.role.id})`}
            ],
            author: {
                name: data.user.tag,
                icon_url: data.user.displayAvatarURL()
            },
            timestamp: Date.now
        }
    ]}).catch(() => {});
    }else
    if(data.status === "Failed"){
    Hook.send({embeds: [
        {
            color: 0xFF0000,
            title: `Reaction Role Logs`,
            description: data.reason,
            fields: [
                {
                    name: `INFO`,
                    value: `Failed ${data.type} role ${data.type === "added" ? "to" : "from"} ${data.user} (${data.user.id})`
                }
            ],
            author: {
                name: data.user.tag,
                icon_url: data.user.displayAvatarURL()
            },
            timestamp: Date.now
        }
    ]}).catch(() => {});
    }
}
class Reactions extends Client{
    constructor(){
        super({
            fetchAllMembers: false,
            disableEveryone: true,
            presence: {
                status: "dnd",
                activity: {
                    name: `${config.roles.length} reaction roles`,
                    type: "WATCHING"
                }
            }
        });
        this.on('ready', () =>  console.log(`${this.user.tag} is now ready!`))
        this.on('shardReady', (id) => console.log(`Shard: ${id} is now ready!`))
        this.on('shardResume', (id, replayed) => console.log(`Shard: ${id} has resumed!`))
        this.on('shardReconnecting', (id) => console.log(`Shard: ${id} is now reconnecting!`))
        this.on('shardDisconnect', (event, id) => console.log(`Shard: ${id} has Disconnected!`))
        this.on('shardError', (error, id) => console.log(`Shard: ${id} Error: ${error.stack}`))
        this.on('raw', async (event) => {
            if(!event) return null;
            if(event.t === "MESSAGE_REACTION_ADD"){
            if(config.roles.length === 0) return null;
            if(!Array.isArray(config.roles)) return console.log(`config.roles isn't an array!`);
             for await (const data of config.roles){
                if(!data.emoji) return null;
                if(!data.channelID) return null;
                if(!data.roleID) return null;
                let guild = this.guilds.cache.get(event.d.guild_id);
                if(!guild) return null;
                let role = guild.roles.cache.get(data.roleID);
                if(!role) return null;
                let channel = guild.channels.cache.get(data.channelID);
                if(!channel) return null;
                if(channel.id !== event.d.channel_id) return null;
                let member = guild.members.cache.get(event.d.user_id);
                if(!member) return null;
                if(member.user.bot) return null;
                let msg = await channel.messages.fetch(data.messageID);
                if(!msg) return null;
                if(msg.id !== event.d.message_id) return null;
                if(event.d.emoji.name === data.emoji || event.d.emoji.id === data.emoji) {
                    await msg.reactions.cache.get(event.d.emoji.id ? event.d.emoji.id : event.d.emoji.name).users.remove(member.id);
                    if(cooldown.has(member.user.id)) return member.send({embed: {color: 0xFF0000, author: {name: guild.name, icon_url: guild.iconURL()}, title: `Woah there.. you're on a 10s cooldown!`}}).catch(() => {});
                    if(!cooldown.has(member.user.id)) cooldown.add(member.user.id);
                    setTimeout(() => cooldown.delete(member.user.id), 10000);
                    if(member.roles.cache.has(role.id)){
                        member.roles.remove(role.id).then(() => {
                            Hook(config.logging.webhook, {
                                status: "Success",
                                user: member.user,
                                type: "Removed",
                                role: role,
                                emoji: event.d.emoji.id ? this.emojis.cache.get(event.d.emoji.id) : event.d.emoji
                            });
                        }).catch((error) => {
                            Hook(config.logging.webhook, {
                                status: "Failed",
                                user: member.user,
                                reason: error.stack,
                                type: "remove"
                            });
                        });
                    }else{
                        member.roles.add(role.id).then(() => {
                            Hook(config.logging.webhook, {
                                status: "Success",
                                user: member.user,
                                type: "Added",
                                role: role,
                                emoji: event.d.emoji.id ? this.emojis.cache.get(event.d.emoji.id) : event.d.emoji
                            });
                        }).catch(() => {
                            Hook(config.logging.webhook, {
                                status: "Failed",
                                user: member.user,
                                reason: error.stack,
                                type: "added"
                            });
                        });
                    }
                }
             }   
            }
        })
    }
};
new Reactions().login(config.token).catch((error) => console.log(`ERROR: ${error.stack}`))
