const express = require("express");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
module.exports = app;

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Started At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};
initializeDBAndServer();

//POST login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "NO_BODY_NOSE");
      console.log(jwtToken);
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "NO_BODY_NOSE", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//GET states API
app.get("/states", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT *
        FROM state ;
    `;
  const dbResponse = await db.all(getStatesQuery);
  jsonResponse = dbResponse.map((eachState) => {
    return {
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    };
  });

  response.send(jsonResponse);
});

//GET state API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT *
        FROM state
        WHERE state_id = ${stateId};
    `;

  const dbState = await db.get(getStateQuery);
  const stateDetails = {
    stateId: dbState.state_id,
    stateName: dbState.state_name,
    population: dbState.population,
  };
  response.send(stateDetails);
});

//create district API (POST method)
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
        INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
        VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths}) ;
    `;

  const dbResponse = await db.run(createDistrictQuery);
  const district_id = dbResponse.lastID;
  response.send("District Successfully Added");
});

//GET district based on district_id API
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT * FROM district WHERE district_id = ${districtId} ;
    `;

    const dbDistrict = await db.get(getDistrictQuery);
    const districtDetails = {
      districtId: dbDistrict.district_id,
      districtName: dbDistrict.district_name,
      stateId: dbDistrict.state_id,
      cases: dbDistrict.cases,
      cured: dbDistrict.cured,
      active: dbDistrict.active,
      deaths: dbDistrict.deaths,
    };
    response.send(districtDetails);
  }
);

//DELETE district API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id = ${districtId} ;
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//update district API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases=${cases},
            cured=${cured},
            active=${active},
            deaths=${deaths}
        WHERE district_id = ${districtId} ;
    `;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET stats of state API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsOfStateQuery = `
        SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
        FROM district
        WHERE state_id = ${stateId} ;
    `;

    const stats = await db.get(getStatsOfStateQuery);
    response.send(stats);
  }
);
