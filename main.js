const width = 900;
const height = 520;
const margin = { top: 40, right: 160, bottom: 60, left: 70 };

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const colors = {
  historical: "#222",
  ssp126: "#12843b",
  ssp245: "#2458db",
  ssp585: "#e32f27"
};

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

function convertTemp(value) {
  const unit = document.getElementById("temp-unit").value;

  if (unit === "C") return value;
  if (unit === "K") return value;
  if (unit === "F") return value * 9 / 5;

  return value;
}

function getTempUnitLabel() {
  const unit = document.getElementById("temp-unit").value;

  if (unit === "K") return "K";
  if (unit === "F") return "°F";

  return "°C";
}

Promise.all([
  d3.csv("climate_warming_d3.csv", d3.autoType),
  d3.csv("global_tas_scenarios.csv", d3.autoType)
]).then(([data, globalData]) => {
  const scenarios = ["ssp126", "ssp245", "ssp585"];
  const legendItems = ["historical", ...scenarios];
  const baselineYear = d3.min(globalData, d => d.year);
  const baselineTemp = d3.mean(
    globalData.filter(d => d.year === baselineYear),
    d => d.temp
  );
  const scenarioOffsets = new Map(
    scenarios.map(scenario => {
      const scenarioStartTemp = d3.mean(
        globalData.filter(d => d.scenario === scenario && d.year === 2015),
        d => d.temp
      );

      return [scenario, scenarioStartTemp - baselineTemp];
    })
  );

  const historicalData = globalData
    .filter(d => d.scenario === "historical")
    .map(d => ({
      scenario: d.scenario,
      year: d.year,
      mean: d.temp - baselineTemp
    }))
    .sort((a, b) => d3.ascending(a.year, b.year));

  const projectionData = data.map(d => {
    const offset = scenarioOffsets.get(d.scenario) || 0;

    return {
      ...d,
      mean: d.mean + offset,
      low: d.low + offset,
      high: d.high + offset
    };
  });
  const projectionStartYear = d3.min(projectionData, d => d.year);
  const finalYear = d3.max(projectionData, d => d.year);

  const startYearSlider = document.querySelector("#start-year-slider");
  const endYearSlider = document.querySelector("#year-slider");
  const startYearLabel = document.querySelector("#start-year-label");
  const endYearLabel = document.querySelector("#year-label");

  const x = d3.scaleLinear()
    .domain([baselineYear, finalYear])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(projectionData, d => d.low),
      d3.max(projectionData, d => d.high)
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const xAxis = svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`);

  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 15)
    .attr("text-anchor", "middle")
    .text("Year");

  const yAxisLabel = svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle");

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(convertTemp(d.mean)));

  const area = d3.area()
    .x(d => x(d.year))
    .y0(d => y(convertTemp(d.low)))
    .y1(d => y(convertTemp(d.high)));

  function updateChart(event) {
    const tempUnitLabel = getTempUnitLabel();

    const selectedScenarios = Array.from(
      document.querySelectorAll(".controls input[type='checkbox']:not(#range-toggle):not(#historical-toggle):checked")
    ).map(d => d.value);

    const showRange = document.querySelector("#range-toggle").checked;
    const showHistorical = document.querySelector("#historical-toggle").checked;

    const minSelectableYear = showHistorical ? baselineYear : projectionStartYear;
    startYearSlider.min = minSelectableYear;
    endYearSlider.min = minSelectableYear;

    let selectedStartYear = +startYearSlider.value;
    let selectedEndYear = +endYearSlider.value;

    selectedStartYear = Math.max(selectedStartYear, minSelectableYear);
    selectedEndYear = Math.max(selectedEndYear, minSelectableYear);

    if (selectedStartYear > selectedEndYear) {
      if (event && event.target.id === "start-year-slider") {
        selectedEndYear = selectedStartYear;
      } else {
        selectedStartYear = selectedEndYear;
      }
    }

    startYearSlider.value = selectedStartYear;
    endYearSlider.value = selectedEndYear;
    startYearLabel.textContent = selectedStartYear;
    endYearLabel.textContent = selectedEndYear;

    const filteredData = projectionData.filter(d =>
      selectedScenarios.includes(d.scenario) &&
      d.year >= selectedStartYear &&
      d.year <= selectedEndYear
    );

    const filteredHistoricalData = showHistorical
      ? historicalData.filter(d =>
          d.year >= selectedStartYear &&
          d.year <= selectedEndYear
        )
      : [];

    const yDomainValues = [
      ...filteredData.flatMap(d => [convertTemp(d.low), convertTemp(d.high)]),
      ...filteredHistoricalData.map(d => convertTemp(d.mean))
    ];

    const yExtent = d3.extent(yDomainValues);
    if (Number.isFinite(yExtent[0]) && Number.isFinite(yExtent[1])) {
      y.domain(yExtent[0] === yExtent[1]
        ? [yExtent[0] - 1, yExtent[1] + 1]
        : yExtent
      ).nice();
    } else {
      y.domain([0, 1]);
    }

    x.domain(selectedStartYear === selectedEndYear
      ? [selectedStartYear - 1, selectedEndYear + 1]
      : [selectedStartYear, selectedEndYear]
    );
    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));
    yAxis.call(d3.axisLeft(y));
    yAxisLabel.text(`Temperature Anomaly Relative to ${baselineYear} (${tempUnitLabel})`);

    svg.selectAll(".historical-line")
      .data(showHistorical ? [filteredHistoricalData] : [])
      .join("path")
      .attr("class", "historical-line")
      .attr("stroke", colors.historical)
      .attr("d", line);

    svg.selectAll(".historical-point")
      .data(filteredHistoricalData, d => d.year)
      .join(
        enter => enter.append("circle")
          .attr("class", "historical-point")
          .attr("r", 5)
          .on("mouseover", function(event, d) {
            const currentUnitLabel = getTempUnitLabel();

            tooltip
              .style("display", "block")
              .html(
                `Year: ${d.year}<br>
                 Temp: ${convertTemp(d.mean).toFixed(2)} ${currentUnitLabel}`
              );
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", function() {
            tooltip.style("display", "none");
          }),
        update => update,
        exit => exit.remove()
      )
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(convertTemp(d.mean)));

    svg.selectAll(".range-area")
      .data(showRange ? selectedScenarios : [], d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "range-area"),
        update => update,
        exit => exit.remove()
      )
      .attr("fill", d => colors[d])
      .attr("d", scenario => {
        const scenarioData = filteredData
          .filter(d => d.scenario === scenario)
          .sort((a, b) => d3.ascending(a.year, b.year));

        return area(scenarioData);
      });

    svg.selectAll(".range-area").lower();
    
    svg.selectAll(".scenario-line")
      .data(selectedScenarios, d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "scenario-line"),
        update => update,
        exit => exit.remove()
      )
      .attr("stroke", d => colors[d])
      .attr("d", scenario => {
        const scenarioData = filteredData
          .filter(d => d.scenario === scenario)
          .sort((a, b) => d3.ascending(a.year, b.year));

        return line(scenarioData);
      });

    svg.selectAll(".point")
      .data(filteredData, d => d.scenario + "-" + d.year)
      .join(
        enter => enter.append("circle")
          .attr("class", "point")
          .attr("r", 4)
          .on("mouseover", function(event, d) {
            const currentUnitLabel = getTempUnitLabel();

            tooltip
              .style("display", "block")
              .html(
                `<strong>${d.scenario.toUpperCase()}</strong><br>
                 Year: ${d.year}<br>
                 Mean: ${convertTemp(d.mean).toFixed(2)} ${currentUnitLabel}<br>
                 Range: ${convertTemp(d.low).toFixed(2)}–${convertTemp(d.high).toFixed(2)} ${currentUnitLabel}`
              );
          })
          .on("mousemove", function(event) {
            tooltip
              .style("left", event.pageX + 12 + "px")
              .style("top", event.pageY - 20 + "px");
          })
          .on("mouseout", function() {
            tooltip.style("display", "none");
          }),
        update => update,
        exit => exit.remove()
      )
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(convertTemp(d.mean)))
      .attr("fill", d => colors[d.scenario]);

    const legend = svg.selectAll(".legend")
      .data(legendItems.filter(d => d !== "historical" || showHistorical))
      .join("g")
      .attr("class", "legend")
      .attr("transform", (d, i) =>
        `translate(${width - margin.right + 30}, ${margin.top + i * 25})`
      );

    legend.selectAll("rect")
      .data(d => [d])
      .join("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", d => colors[d]);

    legend.selectAll("text")
      .data(d => [d])
      .join("text")
      .attr("x", 22)
      .attr("y", 12)
      .text(d => d === "historical" ? "Historical" : d.toUpperCase());
  }

  document.querySelectorAll("input[type='checkbox']")
    .forEach(input => input.addEventListener("change", updateChart));

  startYearSlider.addEventListener("input", updateChart);
  endYearSlider.addEventListener("input", updateChart);

  document.querySelector("#temp-unit")
    .addEventListener("change", updateChart);

  updateChart();
});
