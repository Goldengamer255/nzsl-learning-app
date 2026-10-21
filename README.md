# NZSL Learning Web App

A single-page front end for learning **New Zealand Sign Language (NZSL)**, built with plain HTML, CSS and vanilla JavaScript (no frameworks or libraries). It talks to a REST API service (`nzsl-svc`) running on `http://localhost:5000`.

## Features

| Section | What it does |
| --- | --- |
| **About** | Short introduction to NZSL (Te Reo Turi), one of Aotearoa's three official languages. |
| **Signs** | Live search box. Fetches all signs or searches by term, and shows each sign's image, meanings and description. |
| **Register** | Creates a new user account via a `POST` to the API. |
| **Guestbook** | Shows recent comments in an `<iframe>`. Posting a comment prompts a login dialog (HTTP Basic auth) if you are not already signed in. |
| **Events** | Fetches calendar events as raw iCalendar (`.ics`) text, parses them in the browser and renders event cards with an "Add to calendar" link. |
| **Plots** | Draws two scatter plots from scratch as SVG (quiz score vs practice time, recall accuracy vs signs learned) plus a raw-data table. |

The footer shows the API version, and the nav switches between sections without page reloads.

## Project structure

```
tpan459.html   Page structure and semantic markup
tpan459.css    Styling
tpan459.js     All client-side logic (fetching, parsing, rendering, auth, charts)
```

## Running it

1. Start the NZSL API service so it is listening on `http://localhost:5000`.
2. Open `tpan459.html` in a browser (or serve the folder with any static file server).

If the server is not running, each section degrades gracefully with a message such as "Signs unavailable." instead of breaking.

## Skills learned

**JavaScript and the DOM**
- Building UI entirely with the DOM API (`createElement`, `append`, `replaceChildren`) and using `textContent` instead of `innerHTML` so server data can never inject markup.
- Event handling and single-page navigation: intercepting nav clicks, toggling `hidden` on sections, and refreshing each section's data on view.
- Using the native `<dialog>` element (`showModal()` / `close()`) for a login prompt.

**Asynchronous programming and HTTP**
- `async` / `await` with `fetch`, checking `response.ok`, and handling failures with `try` / `catch`.
- Calling a REST API with `GET` and `POST`, JSON bodies, query strings, and `encodeURIComponent` for safe URLs.
- Avoiding a race condition in live search by tagging each request and discarding stale responses.

**Authentication**
- Implementing HTTP Basic authentication: building the `Authorization` header with `TextEncoder` and `btoa` (UTF-8 safe), keeping login state, and handling `401` responses by re-prompting.
- Understanding why credentials belong in headers and not in URLs.

**Data parsing**
- Parsing the iCalendar format by hand: unfolding wrapped lines, splitting keys and values, stripping parameters and undoing escape sequences.
- Converting UTC timestamps to a local time zone with `Date` and `toLocaleString` (`Pacific/Auckland`).

**Data visualisation**
- Creating SVG with `createElementNS`, and computing coordinate scales between data space and pixel space.
- Writing a "nice numbers" algorithm for axis ticks, plus gridlines, axis titles, rotated labels and hover tooltips, all without a charting library.

**Web fundamentals and accessibility**
- Semantic HTML (`header`, `nav`, `section`, `footer`, `label` / `for`), meaningful `alt` text, and `role="img"` / `aria-label` on charts.
- Defensive UI design: friendly error states, input validation and clearing sensitive fields after use.

**Tooling**
- Developing and debugging against a local API, reading Swagger/OpenAPI documentation, and using the browser dev tools network and console panels.
- Version control and publishing a project to GitHub.

## Notes

- The backend service (`nzsl-svc`) is not included in this repository.
