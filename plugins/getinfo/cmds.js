var urban	   	= require('urban-dictionary'),
	wikipedia   = require('wtf_wikipedia'),
	GetInfo	 	= require(__dirname + '/func.js')
	didYouMean 	= require('didyoumean2'),
	gi		  	= new GetInfo();

var info = {
	name: 'GetInfo',
	about: 'info from various sources',
	last_word: null,
	c_list: null, //store list of cryptocurrencies
	c_last_rank: 0,
	c_convert: ["AUD", "BRL", "CAD", "CHF", "CLP", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "JPY", "KRW", "MXN", "MYR", "NOK", "NZD", "PHP", "PKR", "PLN", "RUB", "SEK", "SGD", "THB", "TRY", "TWD", "ZAR"]
}
exports.info = info;

if(!config.API.mwdictionary || config.API.mwdictionary.key === '') {
	b.log.warn('Missing Merriam-Webster dictionary API key!');
}

if(!config.API.wolframalpha || config.API.wolframalpha.key === '') {
	b.log.warn('Missing Wolframalpha API key!');
}

var cmds = {
	ud: {
		action: 'get urban dictionary term/word definition',
		params: [{
			optional: function(){ return info.last_word !== null },
			name: 'term',
			type: 'text',
			default: function(){ return info.last_word === null ? undefined : info.last_word; }
		}],
		func: function(CHAN, USER, say, args, command_string){
			info.last_word = args.term;
			urban.term(args.term, (error, entries, tags, sounds) => {
				if (error) {
					say({err: error.message});
				} else {

					var filter_entries = entries.filter(function(entry){
						return entry.word.toLowerCase() === args.term.toLowerCase(); 
					});

					if(filter_entries.length > 0)
					{
						entries = filter_entries;
					}

					entries.forEach(function(entry){
						entry.rank = entry.thumbs_up - entry.thumbs_down;
						entry.definition = c.stripColorsAndStyle(entry.definition);
						entry.definition = entry.definition.replace(/[\[\]]/gm, '');

						if(entry.example)
						{
							entry.example = c.stripColorsAndStyle(entry.example);
							entry.example = entry.example.replace(/[\[\]]/gm, '');
						}
					});
					entries.sort(function(a, b){
						if (a.rank > b.rank) return -1;
						if (a.rank < b.rank) return 1;
						return 0;
					});

					var entry = entries[0];

					var str_arr = [ 
						CHAN.t.highlight('UD ' + CHAN.t.term(entry.word)) + ' 👍' + CHAN.t.success(entry.thumbs_up) + ' 👎' + CHAN.t.fail(entry.thumbs_down) + ' ' + CHAN.t.null('-' + entry.author),
						entry.definition
					];
					if(entry.example) str_arr.push( CHAN.t.highlight('e.g. ') + '\u000f' + entry.example);

					say(str_arr, 1, {join: '\n', url: entry.permalink});
				}
			});
		}
	},
	d: {
		action: 'get Merriam-Webster dictionary word definition',
		params: [{
			optional: function(){ return info.last_word !== null },
			name: 'term',
			type: 'text',
			default: function(){ return info.last_word === null ? undefined : info.last_word; }
		}],
		API: ['mwdictionary'],
		func: function(CHAN, USER, say, args, command_string){
			info.last_word = args.term;
			var word = encodeURI(args.term);
			var url = "http://www.dictionaryapi.com/api/v1/references/collegiate/xml/" + word + "?key=" + config.API.mwdictionary.key;
			x.get_url(url, 'xml', function(data){

				if(!data || !data.entry_list || !data.entry_list.entry){
					say({err: 'Nothing found'});
					return;
				}

				try {
					var entries = {};


					//console.log(require('util').inspect(data, true, 10));

					for(var i = 0; i < data.entry_list.entry.length; i++){
						var entry = data.entry_list.entry[i];

						var e_str = '';

						var type = entry.fl && entry.fl.length ? entry.fl[0] : '';
						var pr = entry.pr && entry.pr.length ? ' \\' + entry.pr[0] + '\\' : '';
						var defs = [];

						if(!entry.def) continue;

						entry.def.forEach(function(def){
							var ssl = def.ssl && def.ssl.length ? def.ssl : [];

							def.dt.forEach(function(dt, i){
								var d = typeof dt === 'string' ? dt.replace(/^:/, '').trim() : (typeof dt['_'] === 'string' ? dt['_'].replace(/^:/, '').trim() : '');

								var syn = [];
								if(dt.sx){
									dt.sx.forEach(function(sx){
										if(typeof sx === 'string'){
											syn.push(sx.trim());
										} else if (sx['_'] && typeof sx['_'] === 'string') {
											syn.push(sx['_'].trim())
										}
									});
								}

								if(syn.length > 0) d = d.trim() + ' ' + CHAN.t.considering(syn.join(', '))

								if(d.trim() && dt.un && typeof dt.un[0] === 'string'){
									d += CHAN.t.highlight(' - ' + dt.un.join(', '));
								}

								if(ssl[i] && d.trim()) d = CHAN.t.null(ssl[i] + ':') + ' ' + d.trim();

								if(d.trim()) defs.push(d.trim());
							})
						});

						if(defs.length > 0){
							e_str += ' ' + CHAN.t.success(type + pr);
							defs.forEach(function(def, i){
								e_str += ' ' + CHAN.t.warn(i + 1) + ' ' + def;
							});

							entries[entry.ew[0]] = entries[entry.ew[0]] || [];
							entries[entry.ew[0]].push(e_str);
						}
					}

					if(Object.keys(entries).length === 0){
						say({err: 'Nothing found'});
					} else {
						var closest = didYouMean(word, Object.keys(entries));

						if(entries[closest].length === 1) {
							entries[closest][0] = CHAN.t.highlight('MWD ' + CHAN.t.term(closest)) + entries[closest][0]
						} else {
							entries[closest].unshift(CHAN.t.highlight('MWD ' + CHAN.t.term(closest)));
						}
						
						say(entries[closest], 1, {url: 'http://www.merriam-webster.com/dictionary/' + word, join: '\n'});
					}
				} catch(e) {
					say({err: 'Something went wrong'});
					CHAN.log.error(e);
				}
			});
		}
	},
	wiki: {
		action: 'get wikipedia page and summary',
		params: [{
			optional: function(){ return info.last_word !== null },
			name: 'term',
			type: 'text',
			default: function(){ return info.last_word === null ? undefined : info.last_word; }
		}],
		func: function(CHAN, USER, say, args, command_string){
			var pascal = args.term;
			pascal = pascal.toLowerCase().replace(/\b[a-z]/g, function(letter) {
				return letter.toUpperCase();
			});
			args.term = pascal;
			info.last_word = pascal;

			wikipedia.fetch(args.term).then(doc => {
				var text = doc.plaintext().trim();
				var str = CHAN.t.highlight('Wiki ' + CHAN.t.term(args.term)) + ' ' + text;
				say(str, 1, {url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(args.term)});
			}).catch(err => {
				say({err: 'Nothing found'});
			});
		}
	},
	wr: {
		action: 'WolframAlpha short answer',
		params: [{
			name: 'question',
			type: 'text'
		}],
		API: ['wolframalpha'],
		func: function(CHAN, USER, say, args, command_string){
			gi.wr(CHAN, args.question, function(msg, found){
				if(found){
					say(msg, { join: '\n', lines: 5, force_lines: true })
				} else {
					say(msg);
				}
			});
		}
	},
	stock: {
		action: 'get stock info',
		params: [{
			name: 'symbol',
			type: 'string'
		}],
		settings: ['stock/url'],
		func: function(CHAN, USER, say, args, command_string){

		  x.get_url(CHAN.config.plugin_settings.stock.url + args.symbol, 'json', function(quote){

				if(quote.err){
					 b.users.get_user_data(args.symbol, {
						ignore_err: true,
						skip_say: true,
						return_nicks: true
					}, function(d){
						if(!d) return say({err: 'None found'});

						db.get_data('/nicks', function(users){
							if(!users) return say({err: 'None found'});

							var stats = {
								total: {
									words: 0,
									letters: 0,
									lines: 0
								},
								avr: {
									words: 0,
									letters: 0,
									lines: 0
								},
								usr: {
									words: 0,
									letters: 0,
									lines: 0
								},
								count: 0
							};
							for(var usr in users){
								if(users[usr].spoke){
									stats.count++;

									stats.total.words = stats.total.words + (users[usr].spoke.words ? users[usr].spoke.words : 0);
									stats.total.letters = stats.total.letters + (users[usr].spoke.letters ? users[usr].spoke.letters : 0);
									stats.total.lines = stats.total.lines + (users[usr].spoke.lines ? users[usr].spoke.lines : 0);
								}
							}

							stats.avr.words = stats.total.words / stats.count
							stats.avr.letters = stats.total.letters / stats.count
							stats.avr.lines = stats.total.lines / stats.count

							var symb = d.nick_org;
							if(d.nick_org.length > 4){
								symb = symb.replace(/[aeiou]/gi, '');
								if(symb[0] !== d.nick_org[0]) symb = d.nick_org[0] + symb;

								if(symb.length > 4){
									symb = symb[0] + symb[1] + symb[2] + symb[symb.length - 1];
								}
							}

							if(d.spoke) stats.usr = d.spoke;

							var perc = ((stats.usr.words - stats.avr.words) / stats.avr.words) * 100;

							var str = CHAN.t.highlight(d.nick_org) + ' (' + CHAN.t.highlight(symb.toUpperCase()) + ') -> ' + gi.na(CHAN, {value: stats.usr.words});
							str += ' (' + gi.na(CHAN, {value: stats.usr.words - stats.avr.words}, true) + ' ' + gi.na(CHAN, {value: perc}, true, true) + ')';
							str += ' | Words Avr: ' + gi.na(CHAN, {value: stats.avr.words});
							str += ' | Letters U/A: ' + gi.na(CHAN, {value: stats.usr.letters}) + '/' + gi.na(CHAN, {value: stats.avr.letters});
							str += ' | Lines U/A: ' + gi.na(CHAN, {value: stats.usr.lines}) + '/' + gi.na(CHAN, {value: stats.avr.lines});

							say(str, 1, {skip_verify: true});
						
						});
					});

					return;
				}

				var str = CHAN.t.highlight(quote.name) + ' (' + CHAN.t.highlight(quote.symbol.toUpperCase()) + ') -> ' + gi.na(CHAN, quote.price);
				str += ' (' + gi.na(CHAN, quote.change, true) + ' ' + gi.na(CHAN, quote.changepct, true, true) + ')';
				str += ' | DAY L/H ' + gi.na(CHAN, quote.day_low) + '/' + gi.na(CHAN, quote.day_high);
				str += ' | 52w L/H ' + gi.na(CHAN, quote.fifty_two_week_low) + '/' + gi.na(CHAN, quote.fifty_two_week_high);
				str += ' | P/E: ' + gi.na(CHAN, quote.pe);
				str += ' | P/S: ' + gi.na(CHAN, quote.ps);
				str += ' | P/B: ' + gi.na(CHAN, quote.pb);
				str += ' | Div/yield: ' + gi.na(CHAN, quote.div) + '/' + gi.na(CHAN, quote.yield);
				str += ' | YTD: ' + gi.na(CHAN, quote.ytd*100) + '%';

				say(str, 1, {skip_verify: true});

			}, {
				return_err: true,
				headers: {
					'Accept': 'json'
					}
				}
			);

		}
	},
	cc: {
		action: 'get cryptocurrency info (by default in USD)',
		params: [{
			or: [{
				name: 'list',
				type: 'flag'
			},{
				and: [{
					name: 'symbol',
					type: 'string'
				},{
					optional: true,
					name: 'convert to currency',
					key: 'convert_to',
					type: 'string',
					default: function(USER){ return 'USD' }
				}]
			}]
		}],
		settings: ['stock/url'],
		func: function(CHAN, USER, say, args, command_string){

			if(!info.c_list){
				var url = 'https://api.coinmarketcap.com/v1/ticker/';
				x.get_url(url, 'json', function(list){
					if(list.err){
						say(list);
						b.log.error(url, list);
						return;
					} 

					list.forEach(function(coin){
						info.c_list = info.c_list || {};
						info.c_list[coin.symbol] = coin;

						if(coin.rank > info.c_last_rank) info.c_last_rank = coin.rank;
					});

					if(args.symbol){
						get_info();
					} else if (args.flag){
						list_ccs();
					}

				}, {
					return_err: true
				});
			} else {
				if(args.symbol){
					get_info();
				} else if (args.flag){
					list_ccs();
				}
			}

			function list_ccs(){
				var str_list = [];

				for(var symbol in info.c_list){
					str_list.push(CHAN.t.warn('[' + info.c_list[symbol].rank + '] ') + info.c_list[symbol].name + ' (' + symbol + ')');
				}

				say(str_list.join(', '), 1, {skip_verify: true});
			}

			function get_info(){
				args.convert_to = args.convert_to.toUpperCase();
				if(args.convert_to && info.c_convert.indexOf(args.convert_to) < 0) args.convert_to = 'USD';

				args.symbol = args.symbol.toUpperCase();
				if(!info.c_list[args.symbol]) return say({err: 'No cryptocurrency with symbol ' + args.symbol + ' found.'});

				var url2 = 'https://api.coinmarketcap.com/v1/ticker/' + info.c_list[args.symbol].id + (args.convert_to ? '/?convert=' + args.convert_to : '');
				x.get_url(url2, 'json', function(coin){
					if(coin.err){
						say(coin);
						b.log.error(url2, coin);
						return;
					} 

					var price = +coin[0]['price_' + args.convert_to.toLowerCase()];

					var c = {
						price: {value: price},
						price_24h: {value: (coin[0].percent_change_24h * price / 100)},
						price_24h_perc: {value: +coin[0].percent_change_24h},
						price_7d: {value: (coin[0].percent_change_7d * price / 100)},
						price_7d_perc: {value: +coin[0].percent_change_7d},
					}

					var str = CHAN.t.highlight(coin[0].name) + ' (' + CHAN.t.highlight(coin[0].symbol.toUpperCase()) + ') -> ' + gi.na(CHAN, c.price) + ' ' + args.convert_to;
					str += ' [' + x.score(coin[0].rank, {max: info.c_last_rank, config: CHAN.config, reverse: true}) + '/' + x.score(info.c_last_rank, {max: info.c_last_rank, config: CHAN.config, reverse: true}) + ']';
					str += ' | 24h: ' + gi.na(CHAN, c.price_24h, true) + ' ' + gi.na(CHAN, c.price_24h_perc, true, true);
					str += ' | 7d: ' + gi.na(CHAN, c.price_7d, true) + ' ' + gi.na(CHAN, c.price_7d_perc, true, true);

					say(str, 1, {skip_verify: true});

				}, {
					return_err: true
				});
			}

		}
	},
	yts: {
		action: 'youtube search query',
		params: [{
			name: 'search string',
			type: 'text'
		}],
		func: function(CHAN, USER, say, args, command_string){
			var query = (args.search_string.split(/\s+/)).map(function(x){
				return encodeURIComponent(x);
			});
			say('https://www.youtube.com/results?search_query=' + query.join('+'), 1);
		}
	},
	/*g: { //figure out captcha limits
		action: 'google search query with DDG fallback',
		params: [{
			name: 'search string',
			type: 'text'
		}],
		func: function(CHAN, USER, say, args, command_string){
			gi.goog(CHAN, args.search_string, function(res, url){
				if(res.err){
					gi.ddg(CHAN, args.search_string, function(res2, url2){
						if(res2.err){
							say(res2);
						} else {
							say(res2, 1, {skip_verify: true, url: url2})
						}
					});
				} else {
					say(res, 1, {skip_verify: true, url: url});
				}

			});
		}
	},*/
	ddg: {
		action: 'DuckDuckGo search query with Google fallback',
		params: [{
			name: 'search string',
			type: 'text'
		}],
		func: function(CHAN, USER, say, args, command_string){
			gi.ddg(CHAN, args.search_string, function(res, url){
				if(res.err) return say(res);
				say(res, 1, {skip_verify: true, url: url});

				/*if(res.err){
					gi.goog(CHAN, args.search_string, function(res2, url2){
						if(res2.err){
							say(res2);
						} else {
							say(res2, 1, {skip_verify: true, url: url2})
						}
					});
				} else {
					say(res, 1, {skip_verify: true, url: url});
				}*/

			});
		}
	},
	n: {
		action: 'get nutrition info about food',
		params: [{
			name: 'search string',
			type: 'text'
		}],
		API: ['nutritionix'],
		func: function(CHAN, USER, say, args, command_string){
			gi.nu(CHAN, {
				query: args.search_string,
				handlers: {
					success: function(data){
						if(data.foods && data.foods.length > 0)
						{
							var say_arr = [];
							data.foods.forEach(function(food){
								console.log(food);

								for(var key in food){
									if(food[key] === null) food[key] = 0;
								}

								var str = CHAN.t.highlight(food.food_name);

								var serving = food.serving_qty + food.serving_unit;
								if(food.serving_unit.match(/^serving/i))
								{
									serving = food.serving_unit
										.replace(/^serving \(about /i, '~')
										.replace(/\s|\)/gi, '')
								}

								str += CHAN.t.success(' (' + serving + '/' + food.serving_weight_grams + 'g) ' + Math.round(food.nf_calories) + 'cal, ');
								str += CHAN.t.fail('Carbs: ' + Math.round(food.nf_total_carbohydrate) + 'g (Sug: ' +  food.nf_sugars.toFixed(1) + 'g, Fiber: ' + food.nf_dietary_fiber.toFixed(1) + 'g), ');
								str += CHAN.t.warn('Fat: ' + Math.round(food.nf_total_fat) + 'g (Sat: ' +  food.nf_saturated_fat.toFixed(1) + 'g), ');
								str += CHAN.t.waiting('Chol: ' + Math.round(food.nf_cholesterol) + 'g, ');
								str += CHAN.t.considering('Prot: ' + food.nf_protein.toFixed(1) + 'g ');

								say_arr.push(str);
							});

							say(say_arr, 1, {join: '\n'});
						}
						else
						{
							console.log('succ error', data)
						}
					},
					error: function(err)
					{
						console.log('error', err)
					}
				}
			})
		}
	},
}
exports.cmds = cmds;
