# incoming-orienteerer

This is a web application for announcing orienteerers passing at a relay
control. Data is read from MeOS.

## Acknowledgements

The sound files are from the similar
[prewarning](https://github.com/croister/prewarning) project.

## Requirements

Node.js version >= 22.6.0 is required.

You can obtain it by using `nvm` (Node Version Manager). Download it from
[NVM](https://github.com/nvm-sh/nvm)

After installing `nvm`, you can install and use the required Node.js version
like this:

```bash
nvm install 22.6.0
nvm use 22.6.0
```

Alternatively you can download and install it globally from
[Node.js](https://nodejs.org/en/download/).

## Installation

1. Install [Node.js](https://nodejs.org/en/download/)
2. Run `npm install` in the project directory

## Configuration
Add a `settings.json` file in the root, to configure the application.
There is an `settings.example.json` file to start with.
All available settings can be seen in the `schema.ts` file.

## Browser configuration
Allow audio to be automatically played in the client web browser.

### Chrome

1. Go to `chrome://settings/content/siteDetails?site=http://localhost:3001`
2. Change the `Sound` setting to `Allow`

### Firefox

1. Go to browser settings
2. Search for `autoplay`
3. Click `Settings...` for `Autoplay`
4. Add an exception for `http://localhost:3001` to `Allow Audio and Video`

You might have to replace `localhost` with the IP address of the host
computer, if you are accessing the application from another device.

## Running

1. Start MeOS and open the competition you want to announce
2. Start the MeOS "Informationsserver" under the "Automater" tab.
3. Run `npm start` in the project directory
4. Open a web browser and go to `http://localhost:3001`

It should also be possible to access the application from a browser on another
device on the same network. Replace `localhost` with the IP address of the
host computer.

## Testing

You can use the MeOS backup in `test/relay.meosxml`. Load it in MeOS to get a
simple competition with a few controls and teams. In MeOS you can manually
enter passing times under the "Speaker" tab.

## Logs

Data fetched from MeOS is logged to the `logs` folder. This folder might grow
with time, so it might be a good idea to delete old logs.
