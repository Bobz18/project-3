const width = 900;
const height = 520;
const margin = { top: 40, right: 20, bottom: 60, left: 70 };
let previousHadHistorical = true;


const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const colors = {
  historical: "#222",
  ssp126: "#12843b",
  ssp245: "#2458db",
  ssp370: "#b86cff",
  ssp585: "#e32f27"
};

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("display", "none");

function convertTemp(value) {
  const unit = document.getElementById("temp-unit").value;
  if (unit === "K") return value;
  if (unit === "C") return value - 273.15;
  if (unit === "F") return (value - 273.15) * 9/5 + 32;
  return value;
}

function getTempUnitLabel() {
  const unit = document.getElementById("temp-unit").value;
  if (unit === "K") return "K";
  if (unit === "F") return "°F";
  return "°C";
}

d3.csv("data.csv", d3.autoType).then(data => {
  const startYear = d3.min(data, d => d.year);
  const endYear = d3.max(data, d => d.year);
  const baselineYear = 1850;
  const baselineMean = d3.mean(
    data.filter(d => d.scenario === "historical" && d.year === baselineYear),
    d => d.mean
  );

  const dangerKelvin = baselineMean + 2; // +2 in Kelvin

  const startSlider = document.querySelector("#start-year-slider");
  const endSlider = document.querySelector("#year-slider");
  const startLabel = document.querySelector("#start-year-label");
  const endLabel = document.querySelector("#year-label");

  startSlider.min = startYear;
  endSlider.min = startYear;
  startSlider.max = endYear;
  endSlider.max = endYear;

  const x = d3.scaleLinear()
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
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

  let currentFiltered = [];
  let currentSelected = [];
  let currentShowRange = true;
  let currentUnitLabel = getTempUnitLabel();
  let currentAnomaly = false;
  let currentSmooth = true;

  function getSelectedScenarios() {
    const selected = [];

    // Historical toggle
    if (document.querySelector("#historical-toggle").checked) {
      selected.push("historical");
    }

    // Only scenario checkboxes with a value (ssp126, ssp245, ...)
    document
      .querySelectorAll('.control-group:first-child input[type="checkbox"][value]')
      .forEach(cb => {
        if (cb.checked) selected.push(cb.value);
      });

    return selected;
  }


  function tempMean(d) {
    if (!currentAnomaly) return convertTemp(d.mean);
    return convertTemp(d.mean) - convertTemp(baselineMean);
  }

  function tempLow(d) {
    if (!currentAnomaly) return convertTemp(d.low);
    return convertTemp(d.low) - convertTemp(baselineMean);
  }

  function tempHigh(d) {
    if (!currentAnomaly) return convertTemp(d.high);
    return convertTemp(d.high) - convertTemp(baselineMean);
  }

  function buildLine() {
    const l = d3.line()
      .x(d => x(d.year))
      .y(d => y(tempMean(d)));
    if (currentSmooth) l.curve(d3.curveCatmullRom.alpha(0.9));
    return l;
  }

  function buildArea() {
    const a = d3.area()
      .x(d => x(d.year))
      .y0(d => y(tempLow(d)))
      .y1(d => y(tempHigh(d)));
    if (currentSmooth) a.curve(d3.curveCatmullRom.alpha(0.5));
    return a;
  }

  function highlightScenario(scenario) {
    svg.selectAll(".scenario-line, .range-area, .hover-target")
      .classed("faded", function() {
        const sc = this.getAttribute("data-scenario");
        return sc && sc !== scenario;
      });
  }

  function resetHighlight() {
    svg.selectAll(".scenario-line, .range-area, .hover-target")
      .classed("faded", false);
  }

  function drawChart() {
    if (!currentFiltered.length) return;

    const line = buildLine();
    const area = buildArea();
    const byScenario = d3.group(currentFiltered, d => d.scenario);

    // --- RANGE AREAS ---
    svg.selectAll(".range-area")
      .data(currentShowRange ? currentSelected : [], d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "range-area")
          .attr("data-scenario", d => d),
        update => update,
        exit => exit.remove()
      )
      .attr("fill", s => colors[s])
      .attr("stroke", s => colors[s])
      .attr("stroke-width", 0.4)
      .attr("d", s => {
        const rows = (byScenario.get(s) || []).slice()
          .sort((a, b) => a.year - b.year);
        return rows.length ? area(rows) : null;
      });

    // --- LINES ---
    const lineSel = svg.selectAll(".scenario-line")
      .data(currentSelected, d => d)
      .join(
        enter => enter.append("path")
          .attr("class", "scenario-line")
          .attr("data-scenario", d => d),
        update => update,
        exit => exit.remove()
      );

    lineSel
      .attr("stroke", s => colors[s])
      .attr("stroke-width", 3)
      .attr("d", s => {
        const rows = (byScenario.get(s) || []).slice()
          .sort((a, b) => a.year - b.year);
        return rows.length ? line(rows) : null;
      });

    lineSel
      .on("mouseover", (event, s) => highlightScenario(s))
      .on("mouseout", resetHighlight);

    svg.selectAll(".range-area")
      .on("mouseover", (event, s) => highlightScenario(s))
      .on("mouseout", resetHighlight);

    // --- HOVER TARGETS ---
    svg.selectAll(".hover-target")
      .data(currentFiltered, d => d.scenario + "-" + d.year)
      .join(
        enter => enter.append("circle")
          .attr("class", "hover-target")
          .attr("data-scenario", d => d.scenario)
          .attr("r", 12),
        update => update,
        exit => exit.remove()
      )
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(tempMean(d)))
      .on("mouseover", function(event, d) {
        highlightScenario(d.scenario);
        tooltip
          .style("display", "block")
          .html(
            `<strong>${d.scenario.toUpperCase()}</strong><br>
            Year: ${d.year}<br>
            Mean: ${tempMean(d).toFixed(2)} ${currentUnitLabel}<br>
            Range: ${tempLow(d).toFixed(2)}–${tempHigh(d).toFixed(2)} ${currentUnitLabel}`
          );
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function() {
        tooltip.style("display", "none");
        resetHighlight();
      });

    // ============================================================
    // DANGER LINE (+2°C ABOVE 1850 BASELINE)
    // ============================================================

    // Compute danger line value in the correct unit + anomaly mode
    function dangerValue() {
      if (!currentAnomaly) {
        return convertTemp(dangerKelvin);
      }
      return convertTemp(dangerKelvin) - convertTemp(baselineMean);
    }

    const showDanger = document.querySelector("#danger-toggle").checked;

    svg.selectAll(".danger-line")
      .data(showDanger ? [1] : [])  // dummy value, we compute y ourselves
      .join(
        enter => enter.append("line").attr("class", "danger-line"),
        update => update,
        exit => exit.remove()
      )
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", () => y(dangerValue()))
      .attr("y2", () => y(dangerValue()));
  }


  function drawLegend() {
    const legend = d3.select("#legend");
    legend.selectAll("*").remove();

    currentSelected.forEach(s => {
      const row = legend.append("div")
        .attr("class", "legend-row")
        .attr("data-scenario", s);

      row.append("span")
        .attr("class", "legend-swatch")
        .style("background", colors[s]);

      row.append("span")
        .attr("class", "legend-label")
        .text(s.toUpperCase());
    });
  }

  function updateChart() {
    currentSelected = getSelectedScenarios();
    currentShowRange = document.querySelector("#range-toggle").checked;
    currentAnomaly = document.querySelector("#anomaly-toggle").checked;
    currentSmooth = document.querySelector("#smooth-toggle").checked;
    currentUnitLabel = getTempUnitLabel();

    const earliestSelectedYear = d3.min(
      data.filter(d => currentSelected.includes(d.scenario)),
      d => d.year
    );

    startSlider.min = earliestSelectedYear;
    endSlider.min = earliestSelectedYear;

    // Detect if historical was just re-enabled
    const historicalJustEnabled =
      !previousHadHistorical && currentSelected.includes("historical");

    // Update memory
    previousHadHistorical = currentSelected.includes("historical");

    // Only reset when historical is newly selected
    if (historicalJustEnabled) {
      startSlider.value = earliestSelectedYear;
      endSlider.value = endSlider.max;
    }

    let sYear = Math.max(+startSlider.value, earliestSelectedYear);
    let eYear = Math.max(+endSlider.value, earliestSelectedYear);

    if (sYear > eYear) [sYear, eYear] = [eYear, sYear];

    startLabel.textContent = sYear;
    endLabel.textContent = eYear;

    x.domain([sYear, eYear]);

    currentFiltered = data.filter(d =>
      currentSelected.includes(d.scenario) &&
      d.year >= sYear &&
      d.year <= eYear
    );

    if (!currentFiltered.length) return;

    const yVals = currentFiltered.flatMap(d => [tempLow(d), tempHigh(d)]);
    y.domain(d3.extent(yVals)).nice();

    xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));
    yAxis.call(d3.axisLeft(y));

    yAxisLabel.text(
      currentAnomaly
        ? `Temperature anomaly relative to ${baselineYear} (${currentUnitLabel})`
        : `Global  Mean  Temperature (${currentUnitLabel})`
    );

    drawChart();
    drawLegend();
  }

  document.querySelectorAll("input[type='checkbox']")
    .forEach(cb => cb.addEventListener("change", updateChart));

  startSlider.addEventListener("input", updateChart);
  endSlider.addEventListener("input", updateChart);
  document.querySelector("#temp-unit").addEventListener("change", updateChart);
  document.querySelector("#danger-toggle").addEventListener("change", updateChart);

  updateChart();
});
