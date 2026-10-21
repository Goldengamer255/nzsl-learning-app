"use strict";

function parseEvent(text) {
    const event = {};
    const unfolded = text.replace(/\r?\n[ \t]/g, "");        // join folded lines
    unfolded.split(/\r?\n/).forEach((line) => {
        const colon = line.indexOf(":");
        if (colon === -1) {
            return;                                          // skip lines with no key:value
        }
        const key = line.substring(0, colon).split(";")[0];  // "DTSTART;X=Y" -> "DTSTART"
        const value = line.substring(colon + 1)
            .replace(/\\n/g, "\n")
            .replace(/\\([,;\\])/g, "$1");                   // undo ICS escaping
        event[key] = value;
    });
    return event;
}

function formatIcsDate(icsDate) {                            // "20261109T020000Z"
    const iso = `${icsDate.substring(0, 4)}-${icsDate.substring(4, 6)}-${icsDate.substring(6, 8)}`
        + `T${icsDate.substring(9, 11)}:${icsDate.substring(11, 13)}:${icsDate.substring(13, 15)}Z`;
    return new Date(iso).toLocaleString("en-NZ", {
        timeZone: "Pacific/Auckland",
        dateStyle: "full",
        timeStyle: "short"
    });
}

function buildEventCard(event, index) {
    const card = document.createElement("div");
    card.className = "event-card";

    const title = document.createElement("h3");
    title.textContent = event.SUMMARY;

    const description = document.createElement("p");
    description.textContent = event.DESCRIPTION;

    const location = document.createElement("p");
    location.textContent = "Location: " + event.LOCATION;

    const start = document.createElement("p");
    start.textContent = "Starts: " + formatIcsDate(event.DTSTART);

    const end = document.createElement("p");
    end.textContent = "Ends: " + formatIcsDate(event.DTEND);

    const link = document.createElement("a");
    link.href = `http://localhost:5000/api/Event/${index}`;
    link.textContent = "Add to calendar";

    card.append(title, description, location, start, end, link);
    return card;
}

async function loadEvents() {
    const list = document.getElementById("events-list");
    try {
        const countResponse = await fetch("http://localhost:5000/api/EventCount");
        if (!countResponse.ok) {
            throw new Error("Server returned " + countResponse.status);
        }
        const count = await countResponse.json();

        list.replaceChildren();
        for (let i = 0; i < count; i++) {
            const response = await fetch(`http://localhost:5000/api/Event/${i}`);
            if (!response.ok) {
                throw new Error("Server returned " + response.status);
            }
            const event = parseEvent(await response.text());
            list.appendChild(buildEventCard(event, i));
        }
    } catch (error) {
        list.textContent = "Events unavailable.";
        console.error("Could not load events:", error);
    }
}

function showSection(id) {
    // 1. Hide every section
    const allSections = document.querySelectorAll("section");
    allSections.forEach((section) => {
        section.hidden = true;  // "section" is the current one in the loop
    });

    // 2. Show the one we want
    const target = document.getElementById(id);
    target.hidden = false;
}

const navLinks = document.querySelectorAll("nav a");
navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
        event.preventDefault();
        const sectionId = link.getAttribute("href").substring(1);
        showSection(sectionId);

        // reload the section's data so the page reflects any changes on the server
        if (sectionId === "signs") {
            loadSigns(searchBox.value.trim());
        } else if (sectionId === "events") {
            loadEvents();
        } else if (sectionId === "plots") {
            loadPlots();
        } else if (sectionId === "guestbook") {
            refreshCommentsFrame();
        }
    });
});

async function loadVersion() { // async marks the function as allowed to use await, and await waits for data to arrive to run the line of code.
    try {
        const response = await fetch("http://localhost:5000/api/Version"); // gets the api version from the servers api
        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }
        const version = await response.text();
        document.getElementById("version").textContent = version;
    } catch (error) {
        document.getElementById("version").textContent = "Version unavailable";
        console.error("Could not load version:", error);
    }
}

let latestSearch = 0;   // counts searches so old responses can be recognised

async function loadSigns(term) {
    const thisSearch = ++latestSearch;   // each call gets its own number
    try {
        // if term is empty, use the "all signs" URL, otherwise the /Signs/{term} URL
        const url = term === ""
            ? "http://localhost:5000/api/AllSigns"
            : `http://localhost:5000/api/Signs/${encodeURIComponent(term)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }
        const signs = await response.json();
        if (thisSearch !== latestSearch) {
            return;   // a newer search has started, so discard this result
        }
        renderSigns(signs);
    } catch (error) {
        if (thisSearch === latestSearch) {
            document.getElementById("signs-list").textContent = "Signs unavailable.";
        }
        console.error("Could not load signs:", error);
    }
}

function renderSigns(signs) {
    const list = document.getElementById("signs-list");
    list.replaceChildren();   // clear old cards

    if (signs.length === 0) {
        list.textContent = "No signs found.";
        return;
    }

    signs.forEach((sign) => {
        const card = document.createElement("div");
        card.className = "sign-card";

        const img = document.createElement("img");
        img.src = `http://localhost:5000/api/SignImage/${sign.id}`;  // the SignImage URL using sign.id
        img.alt = sign.meaning.join(", ");  // meaningful alt text for screen readers

        const meaning = document.createElement("h3");
        meaning.textContent = sign.meaning.join(", ");   // sign.meaning is an ARRAY: join it

        const description = document.createElement("p");
        description.textContent = sign.description;

        card.append(img, meaning, description);   // append() accepts several children at once
        list.appendChild(card);
    });
}

async function registerUser() {
    const username = document.getElementById("reg-username").value;
    const password = document.getElementById("reg-password").value;
    const message = document.getElementById("reg-message");

    try {
        const response = await fetch("http://localhost:5000/api/Register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, password: password, address: "" })
        });
        message.textContent = await response.text();   // show whatever the server says
    } catch (error) {
        message.textContent = "Could not reach the server.";
        console.error("Register failed:", error);
    }
}

let authHeader = null;     // null means logged out
let currentUser = null;

function makeBasicAuth(username, password) {
    const bytes = new TextEncoder().encode(username + ":" + password);
    let binary = "";
    bytes.forEach((b) => {
        binary += String.fromCharCode(b);
    });
    return "Basic " + btoa(binary);
}

function updateLoginUi() {
    const status = document.getElementById("login-status");
    const logoutButton = document.getElementById("logout-button");
    if (authHeader === null) {
        status.textContent = "Not logged in.";
        logoutButton.hidden = true;
    } else {
        status.textContent = "Logged in as " + currentUser + ".";
        logoutButton.hidden = false;
    }
}

function refreshCommentsFrame() {
    const frame = document.getElementById("comments-frame");
    frame.src = "http://localhost:5000/api/Comments";   // setting src reloads the frame
}

function openLoginDialog() {
    document.getElementById("login-message").textContent = "";
    document.getElementById("login-dialog").showModal();
}

function logoutUser() {
    authHeader = null;
    currentUser = null;
    updateLoginUi();
}

async function submitLogin() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const message = document.getElementById("login-message");
    const header = makeBasicAuth(username, password);

    try {
        const response = await fetch("http://localhost:5000/api/TestAuth", {
            headers: { Authorization: header }
        });
        if (!response.ok) {
            message.textContent = "Username or password is incorrect.";
            return;
        }
        authHeader = header;
        currentUser = username;
        updateLoginUi();
        document.getElementById("login-password").value = "";
        document.getElementById("login-dialog").close();
        postComment();                      // carry on with the comment they wanted to post
    } catch (error) {
        message.textContent = "Could not reach the server.";
        console.error("Login failed:", error);
    }
}

async function postComment() {
    const input = document.getElementById("comment-text");
    const message = document.getElementById("comment-message");
    const comment = input.value.trim();

    if (comment === "") {
        message.textContent = "Please type a comment first.";
        return;
    }
    if (authHeader === null) {
        openLoginDialog();
        return;
    }

    try {
        const response = await fetch(
            `http://localhost:5000/api/Comment?comment=${encodeURIComponent(comment)}`,
            { method: "POST", headers: { Authorization: authHeader } }
        );
        if (response.status === 401) {
            logoutUser();
            message.textContent = "Your login was rejected. Please log in again.";
            openLoginDialog();
            return;
        }
        message.textContent = await response.text();   // show the server's response
        if (response.ok) {
            input.value = "";
            refreshCommentsFrame();
        }
    } catch (error) {
        message.textContent = "Could not reach the server.";
        console.error("Posting failed:", error);
    }
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }
    return element;
}

function niceStep(roughStep) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const fraction = roughStep / magnitude;
    let nice;
    if (fraction <= 1) {
        nice = 1;
    } else if (fraction <= 2) {
        nice = 2;
    } else if (fraction <= 5) {
        nice = 5;
    } else {
        nice = 10;
    }
    return nice * magnitude;
}

function niceLimits(min, max) {
    const range = (max - min) || 1;               // avoid dividing by zero if all values match
    const step = niceStep(range / 5);
    return {
        min: Math.floor(min / step) * step,
        max: Math.ceil(max / step) * step,
        step: step
    };
}

function drawScatter(data, xField, yField, xTitle, yTitle, title) {
    const width = 600;
    const height = 400;
    const margin = { top: 40, right: 20, bottom: 55, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const bottom = margin.top + plotHeight;

    const xValues = data.map((d) => d[xField]);
    const yValues = data.map((d) => d[yField]);
    const xLimits = niceLimits(Math.min(...xValues), Math.max(...xValues));
    const yLimits = niceLimits(Math.min(...yValues), Math.max(...yValues));

    const xPos = (v) => margin.left + (v - xLimits.min) / (xLimits.max - xLimits.min) * plotWidth;
    const yPos = (v) => bottom - (v - yLimits.min) / (yLimits.max - yLimits.min) * plotHeight;

    const svg = svgEl("svg", {
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label": title
    });

    // title
    const titleText = svgEl("text", {
        x: width / 2, y: 24, "text-anchor": "middle", "font-size": 18, "font-weight": "bold"
    });
    titleText.textContent = title;
    svg.appendChild(titleText);

    // x ticks, gridlines and labels
    for (let v = xLimits.min; v <= xLimits.max; v += xLimits.step) {
        svg.appendChild(svgEl("line", {
            x1: xPos(v), y1: margin.top, x2: xPos(v), y2: bottom, stroke: "#ddd"
        }));
        const label = svgEl("text", {
            x: xPos(v), y: bottom + 18, "text-anchor": "middle", "font-size": 12
        });
        label.textContent = v;
        svg.appendChild(label);
    }

    // y ticks, gridlines and labels
    for (let v = yLimits.min; v <= yLimits.max; v += yLimits.step) {
        svg.appendChild(svgEl("line", {
            x1: margin.left, y1: yPos(v), x2: margin.left + plotWidth, y2: yPos(v), stroke: "#ddd"
        }));
        const label = svgEl("text", {
            x: margin.left - 8, y: yPos(v) + 4, "text-anchor": "end", "font-size": 12
        });
        label.textContent = v;
        svg.appendChild(label);
    }

    // axes
    svg.appendChild(svgEl("line", {
        x1: margin.left, y1: bottom, x2: margin.left + plotWidth, y2: bottom, stroke: "black"
    }));
    svg.appendChild(svgEl("line", {
        x1: margin.left, y1: margin.top, x2: margin.left, y2: bottom, stroke: "black"
    }));

    // axis titles
    const xAxisTitle = svgEl("text", {
        x: margin.left + plotWidth / 2, y: height - 10, "text-anchor": "middle", "font-size": 14
    });
    xAxisTitle.textContent = xTitle;
    svg.appendChild(xAxisTitle);

    const yCentre = margin.top + plotHeight / 2;
    const yAxisTitle = svgEl("text", {
        x: 16, y: yCentre, "text-anchor": "middle", "font-size": 14,
        transform: `rotate(-90 16 ${yCentre})`
    });
    yAxisTitle.textContent = yTitle;
    svg.appendChild(yAxisTitle);

    // one circle per learner
    data.forEach((d) => {
        const circle = svgEl("circle", {
            cx: xPos(d[xField]), cy: yPos(d[yField]), r: 4,
            fill: "#1f77b4", "fill-opacity": 0.6
        });
        const tip = svgEl("title", {});
        tip.textContent = `Learner ${d.learnerId}: ${d[xField]}, ${d[yField]}`;
        circle.appendChild(tip);
        svg.appendChild(circle);
    });

    return svg;
}

function renderDataTable(data) {
    const fields = ["learnerId", "practiceMinutes", "practiceSessions",
        "signsLearned", "quizScore", "recallAccuracy"];
    const table = document.createElement("table");

    const headRow = table.createTHead().insertRow();
    fields.forEach((field) => {
        const th = document.createElement("th");
        th.textContent = field;
        headRow.appendChild(th);
    });

    const body = table.createTBody();
    data.forEach((row) => {
        const tr = body.insertRow();
        fields.forEach((field) => {
            tr.insertCell().textContent = row[field];
        });
    });

    document.getElementById("plot-data").replaceChildren(table);
}

async function loadPlots() {
    const container = document.getElementById("plot-container");
    try {
        const response = await fetch("http://localhost:5000/api/Log");
        if (!response.ok) {
            throw new Error("Server returned " + response.status);
        }
        const data = await response.json();

        container.replaceChildren(
            drawScatter(data, "practiceMinutes", "quizScore",
                "Practice Minutes", "Quiz Score", "Quiz Score vs Practice Time"),
            drawScatter(data, "signsLearned", "recallAccuracy",
                "Signs Learned", "Recall Accuracy", "Recall Accuracy vs Signs Learned")
        );
        renderDataTable(data);
    } catch (error) {
        container.textContent = "Plot data unavailable.";
        console.error("Could not load plot data:", error);
    }
}

document.getElementById("post-button").addEventListener("click", postComment);
document.getElementById("logout-button").addEventListener("click", logoutUser);
document.getElementById("login-submit").addEventListener("click", submitLogin);
document.getElementById("login-cancel").addEventListener("click", () => {
    document.getElementById("login-dialog").close();
});

document.getElementById("reg-button").addEventListener("click", registerUser);

const searchBox = document.getElementById("sign-search");
searchBox.addEventListener("input", () => {
    loadSigns(searchBox.value.trim());
});

showSection("about"); // what's visible when the page first loads
loadVersion();
loadSigns("");
loadEvents();
loadPlots();
updateLoginUi();