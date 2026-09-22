# Bonap for Gladys Assistant

**[Bonap](https://github.com/AymericLeFeyer/bonap) is the friendly interface for [Mealie](https://mealie.io)**: weekly meal planning in a few taps, recipes with pictures, a shopping list with your usual items, statistics and AI meal suggestions. This integration:

- **installs Bonap inside Gladys**, wired to your Mealie (or plugs into a Bonap you already run);
- adds the **"Shopping list"** dashboard widget;
- adds **scene actions**: add an item to the shopping list, get the list (to send it in a message, for instance).

## Before you start: Mealie

Bonap stores everything in Mealie. **No Mealie yet?** Install the [Mealie integration](https://github.com/AymericLeFeyer/gladys-mealie) from the Gladys catalog: it installs Mealie in one click and adds the "Next meal" and "Meal plan" widgets. In its configuration, click **"Create a token for Bonap"**: it shows the Mealie URL and an API token to paste here.

## Configuration

- **Mealie URL**: reachable from the Gladys machine, so an IP address (e.g. `http://192.168.1.10:38123`), **not** `localhost` nor `mealie:9000` (each Gladys integration has its own network). With the Mealie integration, replace `<Gladys IP address>` with the address of your Gladys machine.
- **Mealie API token**: Mealie → Profile → API Tokens, or the Mealie integration button.
- **Bonap**:
  - **Install Bonap in Gladys** (default): Bonap is started and wired to Mealie. Its address is shown in the "Access" section and in the Supervision screen ("Open Bonap" link): Gladys picks the port itself.
  - **I already have Bonap**: enter its URL. When it is `https://`, the widget shows an "Open Bonap" link.

## "Shopping list" widget

On the dashboard, switch to edit mode and add **Shopping list** (Extensions section): the number of items to buy and the first 8, with their aisle. "Shopping list" setting: the name of the Mealie list ("Bonap" by default, the one Bonap uses). Refreshed every 5 minutes and after every item added by a scene.

## Scenes

- **Add to the shopping list** (fields: item — scene variables accepted —, quantity, list) → outputs: `Item added`, `Items to buy`. The list is created when it does not exist.
- **Get the shopping list** (field: list) → outputs: `Items to buy`, `List` (one item per line, "• milk").

Examples: a "More milk" button that adds "Milk"; leaving work, get the shopping list on Telegram.

## Good to know

- A Bonap installed by Gladys is reachable on your local network **without authentication** (the Mealie token is added server-side): never expose its port to the Internet.
- AI suggestions are set up in Bonap → Settings (your AI provider key, stored in your browser).
