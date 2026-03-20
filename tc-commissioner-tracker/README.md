# Transylvania County Commissioner Tracker

A civic accountability tool tracking Transylvania County Commissioner activity across meetings, votes, and public statements. Built to make local government more transparent and accessible.

## Features

- Dashboard with commissioner profiles, topic breakdowns, and election info
- Meeting detail views with key votes, commissioner activity, and public comments
- Commissioner pages with focus areas, public statements, and activity timelines
- Topic pages showing which commissioners are most active on each issue
- AI-powered meeting intake: paste raw minutes and get structured data extracted automatically

## Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/tc-commissioner-tracker.git
   cd tc-commissioner-tracker
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` and add your [Anthropic API key](https://console.anthropic.com/). This is required for the AI meeting minutes processing feature.

4. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app.

## Contributing

This is a community project and contributions are welcome. Whether it's fixing bugs, adding features, improving documentation, or suggesting ideas — all help is appreciated.

## License

MIT
