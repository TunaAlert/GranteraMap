
var canvas
var map
var mapScaler
var sidebar
var sidebarResize
var sidebarContent
var topTextSpan
var datahint
var contextMenu
var measurementsDiv

var labelFont = "Quintessential"

var sidebar_open = false
var view = {
    x: 4096,
    y: 2048,
    zoom: -2,
    scale: 0.25,
    apply: function(){
        mapScaler.style.setProperty('--zoom', view.zoom)
        map.style.transform = `translate(${-view.x}px, ${-view.y}px)`
    }
}
var mouse = {
    x: 0,
    y: 0,
    mapX: 0,
    mapY: 0,
    pressed: 0,
    dragX: 0,
    dragY: 0
}

var resize = {
    size: 0,
    resizing: false,
    lastX: 0
}

var keys = {
    arrowleft: false,
    arrowright: false,
    arrowup: false,
    arrowdown: false
}
var wikiDataLoaded = false

var measurement = {
    locations: [],
    distances: []
}

var mapImage
var locationIcon
var iconsToLoad

function init(){
    canvas = document.querySelector("#canvas")
    map = document.querySelector("#map")
    mapScaler = document.querySelector("#map-scaler")
    sidebar = document.querySelector(".sidebar")
    sidebarResize = document.querySelector(".sidebar-resize")
    sidebarContent = document.querySelector(".sidebar-content")
    wikiPage = document.querySelector(`.sidebar-content iframe`)
    fallbackPage = document.querySelector(`.sidebar-content .not-found`)
    topTextSpan = document.querySelector(".top-text span")
    datahint = document.querySelector("#datahint")
    contextMenu = document.querySelector(".context-menu")
    measurementsDiv = document.querySelector("#measurements")

    canvas.addEventListener("mousedown", mouseDownEvent)
    canvas.addEventListener("mouseup", mouseUpEvent)
    canvas.addEventListener("wheel", wheelEvent)
    canvas.addEventListener("mousemove", mouseMoveEvent)
    canvas.addEventListener("contextmenu", contextMenuEvent)
    document.addEventListener("keyup", keyUpEvent)
    document.addEventListener("keydown", keyDownEvent)
    window.addEventListener("message", wikiMessageReceived)

    sidebarResize.addEventListener("mousedown", startResize)
    document.addEventListener("mousemove", handleResize)

    contextMenu.addEventListener("mousedown", (event)=>event.stopPropagation())
    contextMenu.querySelector("span:nth-child(1)").addEventListener("click", startNewMeasurement)
    contextMenu.querySelector("span:nth-child(2)").addEventListener("click", addToMeasurement)
    contextMenu.querySelector("span:nth-child(3)").addEventListener("click", clearMeasurement)

    locationIcon = {
        unknown: loadImage("unknown icon.png"),
        capital: loadImage("capital icon.png"),
        city: loadImage("city icon.png"),
        town: loadImage("town icon.png"),
        village: loadImage("village icon.png"),
        deseaderra: loadImage("deseaderra icon.png")
    }
    var icons = Object.values(locationIcon)
    iconsToLoad = icons.length
    icons.forEach(icon => {
        icon.addEventListener("load", ()=>iconLoaded())
    })
    
    view.apply()

    loop()
}
document.addEventListener("DOMContentLoaded", init)

function mouseDownEvent(event){
    mouse.dragX = event.clientX
    mouse.dragY = event.clientY

    mouse.pressed = true

    if(event.which == 1){
        contextMenu.style.display = "none"
    }
}

function mouseUpEvent(event){
    mouse.pressed = false
    if(isClick(event))
        sidebar.className = sidebar.className.replaceAll("open", "").replaceAll(/\s+/g, " ")
}

function wheelEvent(event){
    event.preventDefault()

    var delta = -event.deltaY*0.02
    if(delta > 0.5) delta = 0.5
    if(delta < -0.5) delta = -0.5
    changeZoom(delta)
}

function mouseMoveEvent(event){
    var x = event.clientX
    var y = event.clientY

    if(event.buttons&1 && mouse.pressed){
        view.x -= (x-mouse.x)/view.scale
        view.y -= (y-mouse.y)/view.scale

        mapScaler.style.transition = "unset"
        map.style.transition = "unset"
        clampViewCoords()
    }else{
        mouse.pressed = false
    }

    var mapX = (mouse.x - canvas.width/2)/view.scale + view.x
    var mapY = (mouse.y - canvas.height/2)/view.scale + view.y

    mouse.x = x
    mouse.y = y
    mouse.mapX = mapX
    mouse.mapY = mapY
    
    view.apply()
}

function contextMenuEvent(event){
    event.preventDefault()
    contextMenu.menuX = (event.clientX-canvas.width/2)/view.scale+view.x
    contextMenu.menuY = (event.clientY-canvas.height/2)/view.scale+view.y
    contextMenu.style.left = contextMenu.menuX + "px"
    contextMenu.style.top = contextMenu.menuY + "px"

    contextMenu.style.display = "block"
}

function keyDownEvent(event){
    keys[event.key.toLowerCase()] = true
}

function keyUpEvent(event){
    keys[event.key.toLowerCase()] = false
}

function startResize(event){
    if(event.buttons&1){
        resize.resizing = true
        resize.lastX = event.clientX
        wikiPage.style.pointerEvents = "none"
    }
}

function handleResize(event){
    if(event.buttons&1 && resize.resizing){
        var dx = event.clientX - resize.lastX
        resize.lastX = event.clientX
        resize.size -= dx
        var size = limitSidebarResize(resize.size)
        sidebarContent.style.setProperty("--resize", size+"px")
    }else{
        resize.resizing = false
        resize.size = limitSidebarResize(resize.size)
        wikiPage.style.pointerEvents = "unset"
    }
}

function iconLoaded(icon){
    iconsToLoad--
    if(iconsToLoad <= 0){
        mapImage = loadImage("Grantera Map.webp")
        mapImage.onload = ()=>{
            map.style.backgroundImage = "url(\"Grantera\\ Map.webp\")"
        }
        render()
    }
}

function wikiMessageReceived(event){
    if(event.data == 'loaded'){
        wikiDataLoaded = true
    }else if(event.data.loading){
        wikiDataLoaded = false
        openWikiPage(event.data.page, event.data.fallback)
    }
}

function startNewMeasurement(){
    var menuLongLat = pixelCoordsToPolarCoords(contextMenu.menuX, contextMenu.menuY)
    var location = {x: contextMenu.menuX, y: contextMenu.menuY, longitude: menuLongLat.longitude, latitude: menuLongLat.latitude}
    measurement.locations = [location]
    measurement.distances = []
    contextMenu.style.display = "none"
    renderMeasurement()
}

function addToMeasurement(){
    if(measurement.locations?.length == 0){
        startNewMeasurement()
        return
    }
    var menuLongLat = pixelCoordsToPolarCoords(contextMenu.menuX, contextMenu.menuY)
    var lastLocation = measurement.locations[measurement.locations.length-1]
    var location = {x: contextMenu.menuX, y: contextMenu.menuY, longitude: menuLongLat.longitude, latitude: menuLongLat.latitude}
    var distance = greatCircleDistance(lastLocation.longitude, lastLocation.latitude, location.longitude, location.latitude)
    measurement.locations.push(location)
    measurement.distances.push(distance)
    contextMenu.style.display = "none"
    renderMeasurement()
}

function clearMeasurement(){
    measurement.locations = []
    measurement.distances = []
    contextMenu.style.display = "none"
    renderMeasurement()
}

function limitSidebarResize(size){
    if(size < -window.screen.width*0.1) size = -window.screen.width*0.1
    if(size > window.screen.width*0.6) size = window.screen.width*0.6
    return size
}

function loadImage(imageName){
    var img = document.createElement("img")
    img.src = imageName
    return img
}

function changeZoom(deltaZoom, onMouse = true){
    view.zoom += deltaZoom

    if(view.zoom < -2) view.zoom = -2
    if(view.zoom > 3) view.zoom = 3

    view.scale = Math.pow(2, view.zoom)

    if(onMouse){
        view.x = mouse.mapX - (mouse.x - canvas.width/2)/view.scale
        view.y = mouse.mapY - (mouse.y - canvas.height/2)/view.scale
    }

    clampViewCoords()
    if(deltaZoom > 0){
        map.style.transition = "transform cubic-bezier(0, 0.05, 0.95, 1) 0.1s"
        mapScaler.style.transition = "--scale cubic-bezier(0.05, 0, 1, 0.95) 0.1s"
    }else{
        map.style.transition = "transform cubic-bezier(0.05, 0, 1, 0.95) 0.1s"
        mapScaler.style.transition = "--scale cubic-bezier(0, 0.05, 0.95, 1) 0.1s"
    }
    view.apply()
}

function panView(dx, dy){
    map.style.transition = "transform ease 0.1s"
    view.x += dx/view.scale
    view.y += dy/view.scale
    clampViewCoords()
    view.apply()
}

function clampViewCoords(){
    if(view.x < canvas.width/2 / view.scale) view.x = canvas.width/2 / view.scale
    if(view.x > mapImage.width - canvas.width/2 / view.scale) view.x = mapImage.width - canvas.width/2 / view.scale
    
    if(view.y < canvas.height/2 / view.scale) view.y = canvas.height/2 / view.scale
    if(view.y > mapImage.height - canvas.height/2 / view.scale) view.y = mapImage.height - canvas.height/2 / view.scale
}

function isClick(event){
    var x = event.clientX
    var y = event.clientY

    var dx = x - mouse.dragX
    var dy = y - mouse.dragY

    var sqrdelta = dx*dx + dy*dy

    return sqrdelta < 25 && event.which == 1
}

function loop(){
    var mouseLongLat = pixelCoordsToPolarCoords(mouse.mapX, mouse.mapY)

    canvas.width = canvas.getBoundingClientRect().width
    canvas.height = canvas.getBoundingClientRect().height

    datahint.innerText = `x: ${Math.round(mouse.mapX)} y: ${Math.round(mouse.mapY)}, ${Math.abs(mouseLongLat.latitude).toFixed(2)}°${mouseLongLat.y >= 0 ? 'N' : 'S'} ${Math.abs(mouseLongLat.longitude).toFixed(2)}°${mouseLongLat.x >= 0 ? 'E' : 'W'}, scale: ${view.scale.toPrecision(2)}`

    speed = 10
    dx = 0
    dy = 0
    if(keys.arrowup){
        dy -= speed
    }
    if(keys.arrowdown){
        dy += speed
    }
    if(keys.arrowleft){
        dx -= speed
    }
    if(keys.arrowright){
        dx += speed
    }
    if(dx || dy){
        panView(dx, dy)
    }
    if(keys["+"]){
        changeZoom(0.1, false)
    }
    if(keys["-"]){
        changeZoom(-0.1, false)
    }

    var closest = null
    var closestRegion = null
    var closestDistance = 12
    mapdata.regions.forEach((region)=>{
        region.locations.forEach((location)=>{
            var locationLongLat = pixelCoordsToPolarCoords(location.x, location.y)
            var distance = greatCircleDistance(mouseLongLat.longitude, mouseLongLat.latitude, locationLongLat.longitude, locationLongLat.latitude)
            if(distance < closestDistance){
                closestDistance = distance
                closest = location
                closestRegion = region
            }
        })
    })

    if(closestRegion)
        topTextSpan.innerText = closestRegion.name
    else
    topTextSpan.innerText = ""

    setTimeout(loop, 25);
}

function render(){
    mapdata.regions.forEach(region => renderRegion(region))
    mapdata.locations?.forEach(location => renderLocation(location, null))
}

function renderRegion(region){
    var maxX = Number.NEGATIVE_INFINITY
    var minX = Number.POSITIVE_INFINITY
    var maxY = Number.NEGATIVE_INFINITY
    var minY = Number.POSITIVE_INFINITY
    region.locations?.forEach(location => {
        maxX = Math.max(location.x, maxX)
        minX = Math.min(location.x, minX)
        maxY = Math.max(location.y, maxY)
        minY = Math.min(location.y, minY)
    })
    x = (maxX + minX) / 2
    y = (maxY + minY) / 2

    var regionElement = document.createElement("div")
    regionElement.className = "region " + region.id
    regionElement.style.setProperty("--color", region.color)
    regionElement.style.left = x + "px"
    regionElement.style.top = y + "px"
    var labelBox = document.createElement("div")
    labelBox.className = "label-box"
    labelBox.addEventListener("mouseup", (event) => {
        event.stopPropagation()
        
        if(isClick(event)) {
            openWikiPage(region.page, region.name)
        }
    })
    regionElement.appendChild(labelBox)
    var label = document.createElement("span")
    label.className = "label"
    label.innerText = region.name
    labelBox.appendChild(label)
    map.appendChild(regionElement)

    region.locations?.forEach(location => renderLocation(location, region))
}

function renderLocation(location, region){
    var icon = locationIcon[location.type]
    var tintedIcon = tintIcon(icon, region?.color || "white")
    tintedIcon.className = "icon"
    tintedIcon.setAttribute("draggable", false)
    var locationElement = document.createElement("div")
    locationElement.className = "location " + location.type
    locationElement.style.setProperty("--color", region?.color || "white")
    locationElement.appendChild(tintedIcon)
    locationElement.style.left = location.x + "px"
    locationElement.style.top = location.y + "px"
    locationElement.addEventListener("mouseup", (event) => {
        event.stopPropagation()
        
        if(isClick(event)) {
            openWikiPage(location.page, location.name)
        }
    })
    var labelBox = document.createElement("div")
    labelBox.className = "label-box"
    locationElement.appendChild(labelBox)
    var label = document.createElement("span")
    label.className = "label"
    label.innerText = location.name
    labelBox.appendChild(label)
    map.appendChild(locationElement)
}

function renderMeasurement(){
    measurementsDiv.innerHTML = ""

    measurement.locations.forEach((location) => {
        var measureElement = document.createElement("div")
        measureElement.className = "measurement-point"
        measureElement.style.left = location.x + "px"
        measureElement.style.top = location.y + "px"
        measurementsDiv.appendChild(measureElement)
    })

    var totalDistance = 0
    for (let i = 0; i < measurement.distances.length; i++) {
        var distance = measurement.distances[i];
        totalDistance += degreesToDistance(distance)
        var start = measurement.locations[i];
        var end = measurement.locations[i+1];
        var distanceText = document.createElement("div")
        distanceText.innerHTML = `<span>${totalDistance.toFixed(1)}km</span>`
        distanceText.className = "measurement-text"
        distanceText.style.left = end.x + "px"
        distanceText.style.top = end.y + "px"
        measurementsDiv.appendChild(distanceText)

        var lastPoint = start

        for(let d = 1; d < distance; d++){
            var t = d / Math.ceil(distance)
            var interpolated = interpolatePolarCoordinates(start.longitude, start.latitude, end.longitude, end.latitude, t)
            var interpolatedPixel = polarCoordsToPixelCoords(interpolated.longitude, interpolated.latitude)
            interpolated.x = interpolatedPixel.x
            interpolated.y = interpolatedPixel.y
            addMeasurementLine(lastPoint, interpolated)
            lastPoint = interpolated
        }
        addMeasurementLine(lastPoint, end)
    }
}

function addMeasurementLine(start, end) {
    var measureElement = document.createElement("div")
    var vector = {x: end.x - start.x, y: end.y - start.y}
    if(vector.x > 4096) vector.x -= 8192
    if(vector.x < -4096) vector.x += 8192
    vector.length = Math.sqrt(vector.x*vector.x + vector.y*vector.y)
    vector.nx = vector.x/vector.length
    vector.ny = vector.y/vector.length
    measureElement.className = "measurement-line"
    measureElement.style.left = start.x + "px"
    measureElement.style.top = start.y + "px"
    measureElement.style.width = vector.length + "px"
    measureElement.style.setProperty("--angle", Math.acos(vector.nx) * Math.sign(vector.ny) + "rad")
    measurementsDiv.appendChild(measureElement)
}

function tintIcon(icon, tint){
    if(!icon){
        icon = locationIcon["unknown"]
        console.log(icon)
    }
    if(!tint || tint == "white"){
        return icon
    }
    var tintedIcon = document.createElement("canvas")
    tintedIcon.width = icon.width
    tintedIcon.height = icon.height
    var ctx = tintedIcon.getContext("2d")
    ctx.drawImage(icon, 0, 0)
    ctx.globalCompositeOperation = "multiply"
    ctx.fillStyle = tint || "white"
    ctx.fillRect(0, 0, icon.width, icon.height)
    ctx.globalCompositeOperation = "destination-in"
    ctx.drawImage(icon, 0, 0)
    return tintedIcon
}

function openWikiPage(page, fallbackTitle){
    if(page){
        wikiPage.style.display = "block"
        wikiPage.src = `wiki/${page}.html`
        fallbackPage.style.display = "none"
        wikiDataLoaded = false
        wikiPage.onload = (event)=>{
            if(!wikiDataLoaded){
                wikiPage.style.display = "none"
                fallbackPage.style.display = "block"
                fallbackPage.firstElementChild.innerText = fallbackTitle
            }
        }
    }else{
        wikiPage.style.display = "none"
        fallbackPage.style.display = "block"
        fallbackPage.firstElementChild.innerText = fallbackTitle
    }
    sidebar.className = sidebar.className + " open"
}

function pixelCoordsToPolarCoords(x, y){
    x -= 4096
    y -= 2048
    x *= 180/4096
    y *= 180/4096
    x = ((x+540)%360)-180
    y = 180-((y+540)%360)
    return {longitude: x, latitude: y}
}

function polarCoordsToPixelCoords(longitude, latitude){
    var x = ((longitude+540)%360)-180
    var y = 180-((latitude+540)%360)
    x *= 4096/180
    y *= 4096/180
    x += 4096
    y += 2048
    return {x, y}
}

function greatCircleDistance(longitude1, latitude1, longitude2, latitude2){
    var l1 = longitude1/180*Math.PI
    var p1 = latitude1/180*Math.PI
    var l2 = longitude2/180*Math.PI
    var p2 = latitude2/180*Math.PI

    //as found on wikipedia
    var sigma = Math.acos(Math.sin(p1)*Math.sin(p2) + Math.cos(p1)*Math.cos(p2)*Math.cos(l1-l2))

    return sigma*180/Math.PI
}

function interpolatePolarCoordinates(longitude1, latitude1, longitude2, latitude2, t){
    var l1 = longitude1/180*Math.PI
    var p1 = latitude1/180*Math.PI
    var l2 = longitude2/180*Math.PI
    var p2 = latitude2/180*Math.PI

    var vec1 = {x: Math.cos(l1)*Math.cos(p1), y: Math.sin(l1) * Math.cos(p1), z: Math.sin(p1)}
    var vec2 = {x: Math.cos(l2)*Math.cos(p2), y: Math.sin(l2) * Math.cos(p2), z: Math.sin(p2)}
    var interVec = {
        x: vec1.x*(1-t) + vec2.x*t,
        y: vec1.y*(1-t) + vec2.y*t,
        z: vec1.z*(1-t) + vec2.z*t
    }
    var interVecLength = Math.sqrt(interVec.x*interVec.x + interVec.y*interVec.y + interVec.z*interVec.z)
    interVec.x /= interVecLength
    interVec.y /= interVecLength
    interVec.z /= interVecLength

    interVecXYLength = Math.sqrt(interVec.x*interVec.x + interVec.y*interVec.y)

    var lT = Math.acos(interVec.x / interVecXYLength) * Math.sign(interVec.y)
    var pT = Math.asin(interVec.z)

    var longitude = lT/Math.PI*180
    var latitude = pT/Math.PI*180
    return {longitude, latitude}
}

function degreesToDistance(degrees){
    return degrees / 180 * Math.PI * 6000
}