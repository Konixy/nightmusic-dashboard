import stringWidth from 'string-width'
import url from "url"
import ejs from "ejs"
import path from "path"
import chalk from "chalk"
import express from "express"
import passport from "passport"
import bodyParser from "body-parser"
import session from "express-session"
import { NewsChannel, Permissions } from "discord.js"
import { Strategy } from "passport-discord"
import CreateMemoryStore from "memorystore"
import figlet from "figlet"
import GuildSchema from "./src/schema.js"
import config from './config.js'
import mongoose from "mongoose"
import Http from "http"
const app = express()
const http = Http.Server(app)
import Socket from "socket.io"
import { isGeneratorFunction } from 'util/types'
const io = new Socket(http)

let GuildSettings;
try {
  GuildSettings = mongoose.model("prefix")
} catch (error) {
  GuildSettings = mongoose.model("prefix", GuildSchema)
}

const MemoryStore = CreateMemoryStore(session)

const usingCustomDomain = config.usingCustomDomain
const port = process.env.PORT || 80
const configDomain = (config.isLocal ? config.localDomain : config.configDomain)

const discordInvite = config.discordInvite

export default async (client, sendMessage) => {

const templateDir = path.resolve(`${process.cwd()}`);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

let domain;
let callbackUrl;

client.configDomain = configDomain
client.port = port

try {
  const domainUrl = new URL(configDomain);
  domain = {
    host: domainUrl.hostname,
    protocol: domainUrl.protocol,
  };
} catch (e) {
  console.log(e);
  throw new TypeError("Invalid domain specific in the config file.");
}
if (usingCustomDomain) {
  callbackUrl = `${domain.protocol}//${domain.host}/callback`;
} else {
  callbackUrl = `${domain.protocol}//${domain.host}${
    port === 80 ? "" : `:${port}`
  }/callback`;
}

passport.use(
  new Strategy(
    {
      clientID: '832356026740637706',
      clientSecret: 'fFQxTG07jT6DaDduE-hYzev9y0pgCdhS',
      callbackURL: callbackUrl,
      scope: ["identify", "guilds"],
    },
    (accessToken, refreshToken, profile, done) => {
      process.nextTick(() => done(null, profile));
    },
  ),
);

app.use(
  session({
    store: new MemoryStore({ checkPeriod: 86400000 }),
    secret:
      "#@%#&^$^$%@$^$&%#$%@#$%$^%&$%^#$%@#$%#E%#%@$FEErfgr3g#%GT%536c53cc6%5%tv%4y4hrgrggrgrgf4n",
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(passport.initialize())
app.use(passport.session())

app.locals.domain = configDomain.split("//")[1];

app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs')

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);

app.use('/public', express.static('public'));

const renderTemplate = (res, req, template, data = {}) => {

  const baseData = {
    bot: client,
    path: req.path,
    user: req.isAuthenticated() ? req.user : null,
  };
  
  res.render(
    path.resolve(`${templateDir}${path.sep}${template}`),
    Object.assign(baseData, data),
  );
};

const checkAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.session.backURL = req.url;
  res.redirect("/login");
};

app.get('/login', (req, res, next) => {
  if (req.session.backURL) {
    req.session.backURL = req.session.backURL
  } else if (req.headers.referer) {
    const parsed = url.parse(req.headers.referer);
    if (parsed.hostname === app.locals.domain) {
      req.session.backURL = parsed.path;
    }
  } else {
    req.session.backURL = "/";
  }
  next()
}, passport.authenticate('discord'),
)

app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (
    req,
    res,
  ) => {
    
    if (req.session.backURL) {
      const { backURL } = req.session;
      req.session.backURL = null;
      res.redirect(backURL);
    } else {
      res.redirect("/");
    }
  },
);

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    req.logout();
    
    res.redirect("/");
  });
});

app.get("/", (req, res) => {
  renderTemplate(res, req, "home.ejs", {
    discordInvite
  });
});

app.get("/app", checkAuth, async (req, res) => {
  if(req.query.guild_id) {
    return res.redirect('/app')
  }

  let userVoice;
  await req.user.guilds.forEach(async guild => {
    const permsOnGuild = new Permissions(guild.permissions_new);
    if(!permsOnGuild.has(Permissions.FLAGS.MANAGE_GUILD)) return;
    const clientGuild = client.guilds.cache.get(guild.id)
    if(!clientGuild) return;
    clientGuild.members.fetch(req.user.id).then(async member => {
      if(member.voice.channelId) {
          userVoice = member.voice;
      }
    })
  });

  io.on('connection', async (socket) => {
    let server;
    try {
      server = client.servers.get(userVoice.guild.id)
      if(!server) {
        return io.emit('userVoice', { succes: false, msg: "Je ne suis pas connecté à votre salon vocale" })
      }
    } catch {
      server = null
      return io.emit('userVoice', { succes: false, msg: "Vous n'êtes connecté à aucun salon vocale" })
    }
    
    server.dispatcher.on('stateChange', (oldState, newState) => {
      console.log(oldState.status + ' => ' + newState.status)
      if(newState.status === 'playing') {
        io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "playing" })
      } else if(newState.status === "paused" || newState.status === "autopaused") {
        io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "paused" })
      }
    })

    server.connection.on('idle', (oldState, newState) => {
      console.log(oldState.status + ' => ' + newState.status)
      io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "paused" })
    })

    server.connection.on('destroyed' || 'disconnected', (oldState, newState) => {
      console.log(oldState.status + ' => ' + newState.status)
      io.emit('userVoice', { succes: false, msg: "Je ne suis pas connecté à votre salon vocale", state: "error" })
    })

    server.connection.on('ready', (oldState, newState) => {
      console.log(oldState.status + ' => ' + newState.status)
      if(server.currentVideo.url) {
        if(server.dispatcher.state.status === "playing") {
          io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "playing" })
        } else if(server.dispatcher.state.status === 'paused') {
          io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "paused" })
        }
      } else {
        return io.emit('userVoice', { succes: false, msg: "Aucune musique en cours de lecture", state: "error" })
      }
    })

    if(!server.connection) {
      io.emit('userVoice', { succes: false, msg: "Aucune musique en cours de lecture", state: "error" })
    } else if(!server.connection.channelId === userVoice.channel.id) {
      io.emit('userVoice', { succes: false, msg: "Je ne suis pas connecté à votre salon vocale", state: "error" })
    } else if(!server.dispatcher) {
      io.emit('userVoice', { succes: false, msg: "Aucune musique en cours de lecture", state: "error" })
    } else if(server.currentVideo.url) {
      if(server.dispatcher.state.status === "playing") {
        io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "playing" })
      } else if(server.dispatcher.state.status === "idle") {
        io.emit('userVoice', { succes: true, msg: server.currentVideo, state: "paused" })
      }
    } else if(!server.currentVideo.url) {
      io.emit('userVoice', { succes: false, msg: "Aucune musique en cours de lecture", state: "error" })
    }

    socket.on('pause', async () => {
      if(server) {
        if(!server.connection) {
          return io.emit('pause', { succes: false, msg: "Aucune musique en cours de lecture" })
        } else if(!server.connection.channelId === userVoice.channel.id) {
          return io.emit('pause', { succes: false, msg: "Je ne suis pas connecté a votre salon vocale" })
        } else if(!server.dispatcher) {
          return io.emit('pause', { succes: false, msg: "Aucune musique en cours de lecture" })
        } else {
          try {
            if(server.dispatcher.state.status === "paused") {
              await server.dispatcher.unpause()
              return io.emit('pause', { succes: true, msg: "resumed" })
            } else if(server.dispatcher.state.status === "playing") {
              await server.dispatcher.pause()
              return io.emit('pause', { succes: true, msg: 'paused' })
            } else if(server.dispatcher.state.status === "idle") {
              return io.emit('pause', { succes: false, msg: 'Aucune musique en cours de lecture' })
            }
            return io.emit('pause', { succes: false, msg: 'An error occured' })
          } catch (err) {
            io.emit('pause', { succes: false, msg: 'An error occured' })
            return console.log(err)
          }
        }
      } else {
        return io.emit('pause', { succes: false, msg: "Je ne suis pas connecté a votre salon vocale" })
      }
    })
  })
  
  renderTemplate(res, req, "app.ejs", { perms: Permissions, userVoice: userVoice, servers: client.servers });
});


// app.post("/app", checkAuth, async (req, res) => {
//   let userVoice;
//   await req.user.guilds.forEach(async guild => {
//     const permsOnGuild = new Permissions(guild.permissions_new);
//     if(!permsOnGuild.has(Permissions.FLAGS.MANAGE_GUILD)) return;
//     const clientGuild = client.guilds.cache.get(guild.id)
//     if(!clientGuild) return;
//     clientGuild.members.fetch(req.user.id).then(async member => {
//       if(member.voice.channelId) {
//           userVoice = member.voice;
//       }
//     })
//   });
  
//   let server;
//   try {
//     server = client.servers.get(userVoice.guild.id)
//     if(!server) {
//       return res.status(404).send("Je ne suis pas connecté a votre salon vocale")
//     }
//   } catch {
//     server = null
//     return res.status(404).send("Vous n'êtes connecté a aucun salon vocale")
//   }

//   if(server) {
//     if(!server.connection) {
//       return res.status(404).send("Aucune musique en cours de lecture")
//     } else if(!server.connection.channelId === userVoice.channel.id) {
//       return res.status(404).send("Je ne suis pas connecté a votre salon vocale")
//     } else if(!server.dispatcher) {
//       return res.status(404).send("Aucune musique en cours de lecture")
//     } else {
//       try {
//         if(server.dispatcher.state.status === "paused") {
//           server.dispatcher.unpause()
//           return res.status(200).send("resumed")
//         } else if(server.dispatcher.state.status === "playing") {
//           server.dispatcher.pause()
//           return res.status(200).send('paused')
//         } else if(server.dispatcher.state.status === "idle") {
//           return res.status(404).send('Aucune musique en cours de lecture')
//         }
//         return res.status(404).send('An error occured')
//       } catch {
//         return res.status(404).send('An error occured')
//       }
//     }
//   }
// })

app.get("/invite", (req, res) => {
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&scope=bot&response_type=code&redirect_uri=${encodeURIComponent(`${client.configDomain}${client.port === 80 ? "" : `:${client.port}`}/panel`)}`)
});

http.listen(port, null, null, () => {
  console.log(`✅ Server ready on port ${port}`.green)
})
}