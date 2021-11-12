import Discord from 'discord.js'
import colors from 'colors'
import {
    MessageActionRow,
    MessageButton,
    MessageSelectMenu
} from 'discord.js'


import mongoose from 'mongoose'

import ytdl from 'ytdl-core'
import ytsr from 'youtube-search'
import ytpl from 'ytpl'
import Hashmap from 'hashmap'
import {
    joinVoiceChannel,
    getVoiceConnection,
    VoiceConnection,
    AudioPlayerStatus,
    createAudioPlayer,
    AudioPlayer,
    AudioResource,
    StreamType,
    createAudioResource,
    entersState,
    VoiceConnectionDisconnectReason,
    VoiceConnectionStatus
} from '@discordjs/voice'
import Dashboard from "./app.js"

import config from './config.js'


import {
    botNotInVoiceChannel,
    userNotInVoiceChannel,
    emptyQueue
} from './strings.js'

mongoose.connect('mongodb+srv://gcknroot:totoduf"@nightbot.oo2z0.mongodb.net/night_db?retryWrites=true&w=majority', {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        // useFindAndModify: false
    })
    .then(async () => {
        console.log('✅ MongoDB connected'.green);
    });


const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES, Discord.Intents.FLAGS.GUILD_MEMBERS]
});

import prefixShema from "./src/schema.js"

let prefixDb

try {
  prefixDb = mongoose.model("prefix")
} catch (error) {
  prefixDb = mongoose.model("prefix", prefixShema)
}

let prefix;
let volume;

const ownerId = '513309983517966337';

const servers = new Hashmap();
client.servers = servers

let afk = false;

async function runVideo(message) {
    if (!servers.has(message.guild.id)) {
        servers.set(message.guild.id, {
            queue: [],
            currentVideo: {
                url: "",
                title: "Rien pour le moment."
            },
            dispatcher: null,
            connection: null,
            cooldown: false,
        });
    }
    const server = servers.get(message.guild.id);

    const audioPlayer = createAudioPlayer();
    const player = await ytdl(server.currentVideo.url, {
        filter: 'audioonly'
    });
    const voiceChannel = message.member.voice.channel;
    const connection = getVoiceConnection(message.guild.id);
    const resource = createAudioResource(player);
    // resource.volume.setVolume(server.currentVol);
    audioPlayer.play(resource);
    connection.subscribe(audioPlayer);

    server.dispatcher = audioPlayer;
    server.connection = connection;
    afk = false
    await entersState(audioPlayer, AudioPlayerStatus.Playing, 5_000);

    server.queue.shift();

    audioPlayer.on('error', error => {
        console.error(`${error}`.red);
    });

    audioPlayer.on(AudioPlayerStatus.Idle, () => {
        if (server.queue[0]) {
            server.currentVideo = server.queue[0];
            return runVideo(message, connection, server.currentVideo.url);
        } 
            server.currentVideo = ({
                title: 'Rien pour le moment.',
                url: ''
            })
            afk = true;
            setTimeout(() => {
                if(afk === false) return
                afk = false
                connection.destroy()
            }, 120000)
        
    })
    
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        connection.destroy();
    });
    
    connection.on(VoiceConnectionStatus.Destroyed, () => {
        server.currentVideo = ({
            title: 'Rien pour le moment.',
            url: ''
        })
        server.queue = [];
    });

    return message.channel.send(`:notes: En train de jouer : \`${  server.currentVideo.title  }\` !`)
};

client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;

    const serverId = message.guild.id;

    await prefixDb.findById(serverId).then(async (data) => {
        if (!data) {
            prefix = config.prefix;
        } else {
            prefix = data.prefixDb;
        }
    });

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();


    if (!servers.has(serverId)) {
        servers.set(serverId, {
            queue: [],
            currentVideo: {
                url: "",
                title: "Rien pour le moment."
            },
            dispatcher: null,
            connection: null,
            cooldown: false,
            // currentVol: 50,
        });
    }

    const server = servers.get(serverId);

    // ping
    if (command === "ping") {
        const pingMsg = await message.channel.send('Pinging...');
        return pingMsg.edit(`Pong 🏓, l'envoie du message a pris : **${(pingMsg.editedTimestamp || pingMsg.createdTimestamp) - (message.editedTimestamp || message.createdTimestamp)} ms**. ${client.ws.ping ? `Le ping su serveur est de :** ${Math.round(client.ws.ping)} ms**.` : ''}`);
    }

    // help
    if (command === "help" || command === "?") {
        const helpEmbed = new Discord.MessageEmbed()
            .setAuthor(`Commandes ${client.user.username} :`, client.user.displayAvatarURL())
            .addFields({
                name: "**👤・Utilitaires :**",
                value: `> \`${  prefix  }ping\` : renvoie le temp de reponse en *ms* du bot.\n` +
                    `> \`${  prefix  }prefix [prefix]\` : change le prefix tu bot, exemple : \`${  prefix  }prefix !\`.\n` +
                    `> \`${  prefix  }bot\` : renvois un lien pour ajouter le bot.\n`
            })
            .addFields({
                name: "**:notes:・Musiques :**",
                value: `> \`${  prefix  }play <musique>\` : recherche le nom de la musique sur YouTube puis la joue.\n` +
                    `> \`${  prefix  }queue [page]\` : affiche les musiques dans la file d'attente.\n` +
                    `> \`${  prefix  }clear-queue\` : supprime la file d'attente.\n` +
                    `> \`${  prefix  }skip\` : passe a la musique suivante.\n` +
                    `> \`${  prefix  }skipto <nombre>\` : passe a la musique demandé.\n` +
                    `> \`${  prefix  }stop\` : stop la musique.\n` +
                    `> \`${  prefix  }leave\` : quitte le channel vocale.\n` +
                    `> \`${  prefix  }join\` : rejoins le channel vocale dans lequel vous vous trouvez.\n`
            })
            .addFields({
                name: "*<> = obligatoire, [] = facultatif*",
                value: "** **",
            })
            .setTimestamp()
            .setFooter(`Demandé par ${message.author.username}`, `${message.author.displayAvatarURL({dynamic: true})}`);

        message.channel.send({
            embeds: [helpEmbed]
        });
    }

    // play
    else if (command === "play" || command === "p") {
        // cooldown
        if(server.cooldown === false) {
            server.cooldown = true
            setTimeout( () => {
                server.cooldown = false
            }, 1000)
        } else if (server.cooldown === true) {
            return message.channel.send(':hourglass: Veuillez attendre 1 seconde avant de réutiliser cette commande.')
        }

        const voiceConnection = getVoiceConnection(message.guild.id);
        const voiceChannel = message.member.voice.channel

        if (!voiceChannel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (args.length <= 0) {
            return message.channel.send(':x: Arguments invalides !');
        }

        if (!voiceConnection) {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            })
            message.channel.send(`:white_check_mark: Connecté a \`${  voiceChannel.name  }\``)
        }

        if (ytpl.validateID(args.join(' ')) === true) {
            // Playlist
            ytpl(args.join(' ')).then((result) => {

                result.items.forEach((video) => {
                    server.queue.push({
                        title: video.title,
                        url: video.shortUrl
                    });

                })

                server.currentVideo = server.queue[0];
                runVideo(message).then(() => {
                    message.channel.send(`:white_check_mark: Ajout de \`${  result.items.length  }\` musiques de \`${  result.title  }\``)
                })
            })
        } else {
            // Vidéo
            ytsr(args.join(' '), {
                key: 'AIzaSyAi4R6iA2jXju4y2fQXJfrYejmPvpS7Mmk',
                maxResults: 1,
                type: 'video'
            }).then((results) => {

                if (results.results[0]) {
                    const foundVideo = {
                        url: results.results[0].link,
                        title: results.results[0].title
                    };

                    if (server.currentVideo.url != "") {
                        server.queue.push(foundVideo);
                        return message.channel.send(`${":white_check_mark: " + "`"}${  foundVideo.title  }\`` + ` - Ajouté à la file d'attente`)
                    }
                    server.currentVideo = foundVideo;
                    runVideo(message);
                } else {
                    message.channel.send(':x: Aucune vidéo trouvé !');
                }
            })
        }
    }

    // queue
    else if (command === 'queue' || command === 'q') {
        const voiceConnection = getVoiceConnection(message.guild.id);

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel);
        }

        let page = args[0]
        if (args[0] === undefined || args[0] === ' ') {
            page = 1
        }
        const numberItems = 10;
        const startingItem = (page - 1) * numberItems;
        const queueLength = server.queue.length;

        let itemPerPage = startingItem + numberItems;
        let totalPages = 1;

        const embed = new Discord.MessageEmbed()
            .setTitle(`File d'attente pour ${message.author.username}`)
            .addField('**:notes:・ En train de jouer : **', `> [${  server.currentVideo.title  }](${  server.currentVideo.url  })`);

        if (queueLength > 0) {
            let value = "";

            if (queueLength > numberItems) {
                totalPages = Math.ceil(queueLength / numberItems)
            }

            if (page < 0 || (page) > totalPages) {
                return message.channel.send(":x: Cette page n'existe pas.");
            }

            if ((queueLength - startingItem) < numberItems) {
                itemPerPage = (queueLength - startingItem) + startingItem;
            }

            for (let i = startingItem; i < itemPerPage; i++) {
                const video = server.queue[i];
                value += `> \`${  i + 1  }.\` ` + `[${  video.title  }](${  video.url  })` + `\n`;
            }
            embed.addField("**:fast_forward:・ A venir :**", value);
        }

        embed.setTimestamp();
        embed.setFooter(`Demandé par ${message.author.username}  •  Page ${page}/${totalPages}`, `${message.author.displayAvatarURL()}`);

        return message.channel.send({
            embeds: [embed]
        });

    }

    // skip
    else if (command === "skip" || command === 's') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel)
        }

        if (!server.queue[0]) {
            server.currentVideo = {
                url: "",
                title: "Rien pour le moment."
            }
            return message.channel.send(emptyQueue);
        }

        const dispatcher = createAudioPlayer();
        server.currentVideo = server.queue[0]
        server.queue.shift();
        const player = await ytdl(server.currentVideo.url, {
            filter: 'audioonly'
        });
        const resource = createAudioResource(player);
        dispatcher.play(resource);
        voiceConnection.subscribe(dispatcher);
        await entersState(dispatcher, AudioPlayerStatus.Playing, 5_000);
        message.channel.send(`:fast_forward: Musique en cours : \`${  server.currentVideo.title  }\``)
        dispatcher.on(AudioPlayerStatus.Idle, () => {
            if (server.queue[0]) {
                server.currentVideo = server.queue[0];
                return runVideo(message, server.connection, server.currentVideo.url);
            } 
                server.currentVideo = ({
                    title: 'Rien pour le moment.',
                    url: ''
                })
            
        })
    }

    // skipto
    else if (command === 'skipto' || command === 'st') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const voiceChannel = message.member.voice.channel;

        let index = args[0]

        if (args[0] === undefined || args[0] === ' ' || args[0] != Number) {
            index = 1
        }

        if (!voiceChannel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel)
        }

        index--;

        if (!server.queue[index]) {
            return message.channel.send(emptyQueue);
        }

        server.currentVideo = server.queue[index];
        message.channel.send(`:fast_forward: Musique en cours : \`${  server.currentVideo.title  }\``)
        const dispatcher = createAudioPlayer();
        const player = await ytdl(server.currentVideo.url, {
            filter: 'audioonly'
        });
        const resource = createAudioResource(player);
        dispatcher.play(resource);
        voiceConnection.subscribe(dispatcher);
        await entersState(dispatcher, AudioPlayerStatus.Playing, 5_000);
        server.queue.splice(index, 1);
        dispatcher.on(AudioPlayerStatus.Idle, () => {
            if (server.queue[0]) {
                server.currentVideo = server.queue[0];
                return runVideo(message, server.connection, server.currentVideo.url);
            } 
                server.currentVideo = ({
                    title: 'Rien pour le moment.',
                    url: ''
                })
            
        })
    }

    // clear queue
    else if (command === 'clear-queue' || command === 'cq') {
        server.queue = [];
        message.channel.send(":white_check_mark: File d'attente éffacé avec succès !");
    }

    // leave
    else if (command === 'leave' || command === 'disconnect' || command === 'l') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const voiceChannel = message.member.voice.channel;

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel);
        }

        if (!voiceChannel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        voiceConnection.destroy();
        server.currentVideo = ({
            title: 'Rien pour le moment',
            url: ''
        })
        server.queue = [];

        return message.channel.send(":white_check_mark: Déconnecté");
    }

    // join
    else if (command === 'join' || command === 'j') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        await joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        })

        message.channel.send(`:white_check_mark: Connecté a \`${  voiceChannel.name  }\``)
    }

    // stop
    else if (command === 'stop' || command === 'pause') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const {dispatcher} = server;

        if (!message.member.voice.channel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel);
        }

        if (dispatcher) {
            dispatcher.pause();
            return message.channel.send(":pause_button: Pause")
        }

        if (server.currentVideo.url === '') {
            return message.channel.send(':x: Aucune musique en cours de lecture.')
        }

        message.channel.send(':x: Une erreur est survenue.')
    }

    // resume
    else if (command === 'resume' || command === 'replay' || command === 'r') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const {dispatcher} = server;

        if (!message.member.voice.channel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel);
        }

        if (server.currentVideo.url === '') {
            return message.channel.send(':x: Aucune musique en cours de lecture.')
        }

        if (dispatcher) {
            dispatcher.unpause();
            return message.channel.send(`:arrow_forward: Reprise`)
        }

        message.channel.send(':x: Une erreur est survenue.')
    }

    // prefix
    else if (command === 'prefix' || command === 'set-prefix') {
        if (args.length <= 0) {
            return message.channel.send(`Mon préfix sur le serveur est : \`${  prefix  }\``);
        }

        if (!message.member.permissions.has('MANAGE_GUILD')) {
            message.channel.send(":x: Vous n'avez pas les permissions de faire ceci !")
        }

        prefixDb.findById(serverId, async (err, data) => {
            if (err) {
                console.error(`${err}`.red)
                message.channel.send(":x: Une erreur s'est produite :/")
            } else {
                await prefixDb.findOneAndDelete({
                        _id: serverId
                    })
                    .then(() => {
                        const newDb = new prefixDb({
                            _id: serverId,
                            prefixDb: args.join(" "),
                            volDb: 50,
                        });
                        newDb.save()
                    })

                prefix = args.join(" ")
                return message.channel.send(`:white_check_mark: Préfix changé pour le serveur : \`${  prefix  }\``)
            }
        })
    }

    // add-bot
    else if (command === 'bot' || command === 'add-bot') {

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setStyle('LINK')
                .setURL('https://discord.com/api/oauth2/authorize?client_id=832356026740637706&permissions=8&redirect_uri=https%3A%2F%2Fdiscord.gg%2Fn9NsX8UtRe&scope=bot')
                .setLabel('Click ICI')
            )

        message.channel.send({
            content: "Tu peut m'ajouter sur ton serveur en clickant sur ce boutton !",
            components: [row]
        })
    }

    // link
    else if (command === 'link' || command === 'liens') {


        const option1 = {
            emoji: '🌐',
            label: 'notre Site internet',
            description: 'Le site internet officiel de Night MC',
            value: 'web',
        }

        const option2 = {
            emoji: '879789835462803497',
            label: 'Notre bot Discord',
            description: 'Un bot discord de Music officiel développé par Night MC',
            value: 'bot',
        }
        const option3 = {
            emoji: '861300762693206056',
            label: 'Notre serveur discord',
            description: "Le serveur discord officiel de Night MC",
            value: 'discord',
        }

        const row = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                .addOptions([option2, option3])
                .setPlaceholder('Clickez ici pour dérouler la liste')
                .setCustomId('menu')
            )

        client.on('interactionCreate', async (interaction, menu) => {
            if(!interaction.isSelectMenu()) return;
            if(!interaction.customId === 'menu') return;

            if (interaction.values == 'discord') {
                // await interaction.deferReply();
                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setStyle('LINK')
                            .setURL('http://discord.nightmc.fr')
                            .setLabel('ou click ICI'),
                    )

                interaction.reply({ content: 'Notre serveur discord : https://discord.gg/QJ3cmpQwKB', components: [row]})
            } else if (interaction.values == 'bot') {
                // await interaction.deferReply();
                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setStyle('LINK')
                            .setURL('https://discord.com/api/oauth2/authorize?client_id=832356026740637706&permissions=8&redirect_uri=https%3A%2F%2Fdiscord.gg%2Fn9NsX8UtRe&scope=bot')
                            .setLabel('Click ICI'),
                    )

                interaction.reply({ content: 'Ajoute le bot sur ton server : ', components: [row]})
            } else if (interaction.values == 'web') {
                // await interaction.deferReply();
                const row = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setStyle('LINK')
                            .setURL('https://nightmc.fr')
                            .setLabel('Click ICI'),
                    )

                interaction.reply({ content: 'Site web de Night MC : ', components: [row]})
            }
        })

        message.channel.send({
            content: 'Clickez sur un lien parmis cette liste.',
            components: [row]
        });
    }

    // execute
    else if (command === "exe") {
        if (message.author.id !== ownerId) {
            return;
        } if (message.author.id === ownerId) {
            try {
                const result = eval(args.join(' '));
                return message.channel.send(result);
            } catch (err) {
                console.log(`${err}`.red)
                return message.channel.send(err)
            }
        }
        message.channel.send('internal error')
        console.log('error at command execute, invalid owner id')
    }

    // volume
    else if (command === 'volume' || command === 'vol' || command === 'v') {

        return message.channel.send(':x: Commande indisponible');

    }

    // dispatcher
    else if (command === 'dispatcher' || command === 'player' || command === 'pl') {
        const voiceConnection = getVoiceConnection(message.guild.id);
        const {dispatcher} = server;

        if (!message.member.voice.channel) {
            return message.channel.send(userNotInVoiceChannel);
        }

        if (!voiceConnection) {
            return message.channel.send(botNotInVoiceChannel);
        }

        if (!dispatcher) { message.channel.send(':x: Une erreur est survenue.') }
        
        const embed = new Discord.MessageEmbed()

        if (server.currentVideo.url === '') {
            embed.setTitle(':x:・Aucune musique en cours de lecture.');
        } else {
            embed.setTitle(`:notes:・${  server.currentVideo.title}`);
        }

        message.channel.send({ embeds: [ embed ]}).then(async msg => {
            dispatcher.on('idle', async () => {
                setTimeout(() => {
                    if(!server.currentVideo.url) {
                        msg.edit({ embeds: [ (embed.setTitle(':x:・Aucune musique en cours de lecture.')) ] })
                        console.log('none')
                    } else {
                        msg.edit({ embeds: [ (embed.setTitle(`:notes:・${  server.currentVideo.title}`)) ] })
                        console.log('ya')
                    }
                }, 1000)
            })
        })
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.type === 'DM') return;
    if (message.content.startsWith(`<@${  client.user.id  }>`)) {
        message.channel.send(`Mon préfix sur le serveur est \`${  prefix  }\`.`)
    }
})

function sendMessage(message, guildId, channelId) {
  const guild = client.guilds.cache.get(guildId)
  if(!guild) return console.log('Invalid guild id')
  const channel = guild.channels.cache.get(channelId)
  if(!channel) return console.log('Invalid channel id')
  channel.send(message)
}

client.on("ready", async () => {
  console.log("Fetching members...".yellow);
  for (const [id, guild] of client.guilds.cache) {
    await guild.members.fetch().catch(err => {
      console.error(`${err}`.red)
    })
  }
  console.log("Fetched members.".green);

  let stateStatus = 7;
  const statuses = [
      `sur ${client.guilds.cache.size} serveurs`,
      `${config.prefix}help pour voir toutes les commandes`,
      `dev par ${client.users.cache.get(ownerId).tag}`,
      `${config.prefix}help pour voir toutes les commandes`,
      `discord.io/night_mc`,
      `${config.prefix}help pour voir toutes les commandes`,
      `préfix : ${config.prefix}`,
      `${config.prefix}help pour voir toutes les commandes`,
      `${client.users.cache.size} utilisateurs`
  ];
  setInterval(() => {
      const status = statuses[stateStatus++];
      if (stateStatus > 7) {
          stateStatus = 0
      }
      client.user.setActivity(status, {
          type: "LISTENING"
      });
  }, 5000)

  await Dashboard(client, sendMessage);
    client.user.setStatus('idle');
    console.log(`Logged in as `.green + `${client.user.tag}`.yellow);
});

// client.once('ready', async () => {
//     await Dashboard(client, sendMessage)
//     client.user.setStatus('idle');
//     console.log(`Logged in as `.green + `${client.user.tag}`.yellow);
// })

client.on('error', (error) => console.error(`${error}`.red));

client.login(config.token);