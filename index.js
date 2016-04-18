var Botkit = require('botkit')

// Expect a SLACK_TOKEN environment variable
var slackToken = process.env.SLACK_TOKEN
if (!slackToken) {
  console.error('SLACK_TOKEN is required!')
  process.exit(1)
}

var controller = Botkit.slackbot()
var bot = controller.spawn({
  token: slackToken
})

bot.startRTM(function (err, bot, payload) {
  if (err) {
    throw new Error('Could not connect to Slack')
  }
})

controller.on('bot_channel_join', function (bot, message) {
  bot.reply(message, "I'm here!")
})

controller.hears(['add (.*)', 'add (.*) ounces', 'add (.*) ounces of water'],
    'direct_message,direct_mention,mention', function (bot, message) {
        var ounces = message.match[1];
        ounces = parseInt(ounces);

        if (!isInteger(ounces)) {
            bot.reply(message,
                'I\'m sorry, I can only add ounces of water.\n' +
                'Try something more like \'add 8\' or \'add 8 ounces\'.');
        }
        else {
            var ouncetotal = 0;

            controller.storage.users.get(message.user, function (err, user) {
                if (!user) {
                    user = {
                        id: message.user,
                    };
                    user.water = 0;
                }

                ouncetotal = parseInt(user.water) + parseInt(ounces);
            });

            bot.reply(message, 'Got it. I\'ll add ' + ounces + ' ounces of water for you.');

            controller.storage.users.save({ id: message.user, water: ouncetotal }, function (err) {
                if (err) {
                    bot.reply(message, 'Oops... something went wrong. I wasn\'t able to add ' + ounces + ' ounces.');
                }
            });
        }
    });

controller.hears(['how much water have i had today', 'how much water have i drank today',
    'show me todays water', 'total'],
    'direct_message,direct_mention,mention', function (bot, message) {
        controller.storage.users.get(message.user, function (err, user) {
            if (!user) {
                user = {
                    id: message.user,
                };
                user.water = 0;
            }

            if (user.water <= 0) {
                bot.reply(message, 'You haven\'t had any water yet today.');
            }
            else {
                bot.reply(message, 'You\'ve had ' + user.water + ' ounces of water today.');
            }
        });
    });

controller.hears(['hello', 'hi'],
    'direct_message,direct_mention,mention', function (bot, message) {
        controller.storage.users.get(message.user, function (err, user) {
            if (user && user.name) {
                bot.reply(message, 'Hello ' + user.name + '!!');
            } else {
                bot.reply(message, 'Hello.');
            }
        });
    });

controller.hears(['call me (.*)', 'my name is (.*)'],
    'direct_message,direct_mention,mention', function (bot, message) {
        var name = message.match[1];
        controller.storage.users.get(message.user, function (err, user) {
            if (!user) {
                user = {
                    id: message.user,
                };
            }
            user.name = name;
            controller.storage.users.save(user, function (err, id) {
                bot.reply(message, 'Got it. I\'ll call you ' + user.name + ' from now on.');
            });
        });
    });

controller.hears(['what is my name', 'who am i'],
    'direct_message,direct_mention,mention', function (bot, message) {

        controller.storage.users.get(message.user, function (err, user) {
            if (user && user.name) {
                bot.reply(message, 'Your name is ' + user.name);
            } else {
                bot.startConversation(message, function (err, convo) {
                    if (!err) {
                        convo.say('I do not know your name yet!');
                        convo.ask('What should I call you?', function (response, convo) {
                            convo.ask('You want me to call you `' + response.text + '`?', [
                                {
                                    pattern: 'yes',
                                    callback: function (response, convo) {
                                        // since no further messages are queued after this,
                                        // the conversation will end naturally with status == 'completed'
                                        convo.next();
                                    }
                                },
                                {
                                    pattern: 'no',
                                    callback: function (response, convo) {
                                        // stop the conversation. this will cause it to end with status == 'stopped'
                                        convo.stop();
                                    }
                                },
                                {
                                    default: true,
                                    callback: function (response, convo) {
                                        convo.repeat();
                                        convo.next();
                                    }
                                }
                            ]);

                            convo.next();

                        }, { 'key': 'nickname' }); // store the results in a field called nickname

                        convo.on('end', function (convo) {
                            if (convo.status == 'completed') {
                                bot.reply(message, 'OK! I will update my dossier...');

                                controller.storage.users.get(message.user, function (err, user) {
                                    if (!user) {
                                        user = {
                                            id: message.user,
                                        };
                                    }
                                    user.name = convo.extractResponse('nickname');
                                    controller.storage.users.save(user, function (err, id) {
                                        bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                    });
                                });
                            } else {
                                // this happens if the conversation ended prematurely for some reason
                                bot.reply(message, 'OK, nevermind!');
                            }
                        });
                    }
                });
            }
        });
    });


controller.hears(['shutdown'],
    'direct_message,direct_mention,mention', function (bot, message) {

        bot.startConversation(message, function (err, convo) {

            convo.ask('Are you sure you want me to shutdown?', [
                {
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        convo.say('Bye!');
                        convo.next();
                        setTimeout(function () {
                            process.exit();
                        }, 3000);
                    }
                },
            {
                pattern: bot.utterances.no,
                default: true,
                callback: function (response, convo) {
                    convo.say('*Phew!*');
                    convo.next();
                }
            }
            ]);
        });
    });

controller.hears(['reset'],
    'direct_message,direct_mention,mention', function (bot, message) {
            bot.reply(message, 'Got it. I\'ll reset the ounces of water for you.');
            controller.storage.users.save({ id: message.user, water: 0 }, function (err) {
                if (err) {
                    bot.reply(message, 'Oops... something went wrong. I wasn\'t able to add ' + ounces + ' ounces.');
                }
            });
    });

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function (bot, message) {
        var uptime = formatUptime(process.uptime());
        bot.reply(message, ':I am a bot named <@' + bot.identity.name + '>');
    });

controller.hears(['help'],
    'direct_message,direct_mention,mention', function (bot, message) {
        bot.reply(message, 'Commands:' + '\n\n' +
           '*Greeting*\n' +
           'hello\n' + 'hi\n' + 'call me _name_\n' + 'my name is _name_\n' + 'who am i\n' + 'what is my name\n' + '\n\n' +
           '*Bot*\n' +
           'who are you\n' + 'what is your name\n' + 'identify yourself\n' + 'uptime\n' + '\n\n' +
           '*Adding Water*\n' +
           'add _number_\n' + 'add _number_ ounces\n' + 'add _number_ ounces of water\n' + '\n\n' +
           '*Getting Daily Total*\n' +
           'total\n' + 'show me todays water\n' + 'how much have i drank today\n' + 'how much water have i had today\n' + '\n\n' + 
           '*Remove Water*\n' +
           'reset\n' + '\n\n'
           );
    });

/* helpers */

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

function isInteger(x) {
    return parseInt(x, 10) === x;
}
