
var canvas
var map
var mapScaler
var sidebar
var sidebarResize
var sidebarContent
var topTextSpan
var datahint
var contextMenu

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

var mapImage
var locationIcon

function init(){
    canvas = document.querySelector("#canvas")
    map = document.querySelector("#map")
    mapScaler = document.querySelector("#map-scaler")
    sidebar = document.querySelector(".sidebar")
    sidebarResize = document.querySelector(".sidebar-resize")
    sidebarContent = document.querySelector(".sidebar-content")
    topTextSpan = document.querySelector(".top-text span")
    datahint = document.querySelector("#datahint")
    contextMenu = document.querySelector(".context-menu")

    canvas.addEventListener("mousedown", mouseDownEvent)
    canvas.addEventListener("mouseup", mouseUpEvent)
    canvas.addEventListener("wheel", wheelEvent)
    canvas.addEventListener("mousemove", mouseMoveEvent)
    canvas.addEventListener("contextmenu", contextMenuEvent)
    document.addEventListener("keyup", keyUpEvent)
    document.addEventListener("keydown", keyDownEvent)

    sidebarResize.addEventListener("mousedown", startResize)
    document.addEventListener("mousemove", handleResize)

    document.querySelectorAll(".wiki-page h2").forEach((h2) => {
        h2.addEventListener("click", (event)=>{
            var open = h2.className.includes("open")
            if(open){
                h2.className = h2.className.replaceAll("open", "").replaceAll(/\s+/g, "")
                h2.nextElementSibling.className = h2.nextElementSibling.className.replaceAll("open", "").replaceAll(/\s+/g, "")
            }else{
                h2.className += " open"
                h2.nextElementSibling.className += " open"
            }
        })
    })

    document.querySelectorAll(".wiki-page .reference").forEach((reference) => {
        var ref = reference.getAttribute("ref")
        if(!ref || !document.querySelector(`.wiki-page.${ref}`)){
            reference.className += " unknown"
        }
        reference.addEventListener("click", (event)=>{
            openWikiPage(ref, reference.innerText)
        })
    })

    mapImage = loadImage("Grantera Map.webp")
    locationIcon = {
        unknown: loadImage("unknown icon.png"),
        capital: loadImage("capital icon.png"),
        city: loadImage("city icon.png"),
        town: loadImage("town icon.png"),
        village: loadImage("village icon.png"),
        deseaderra: loadImage("deseaderra icon.png")
    }

    mapImage.onload = ()=>{
        map.style.backgroundImage = "url(\"Grantera\\ Map.webp\")"
    }
    
    render()
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
    contextMenu.style.left = (event.clientX-canvas.width/2)/view.scale+view.x + "px"
    contextMenu.style.top = (event.clientY-canvas.height/2)/view.scale+view.y + "px"

    //contextMenu.style.display = "block"
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
    }
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
    mapScaler.style.transition = "--zoom linear 0.1s"
    if(deltaZoom > 0)
        map.style.transition = "transform cubic-bezier(0, 0.05, 0.95, 1) 0.1s"
    else
        map.style.transition = "transform cubic-bezier(0.05, 0, 1, 0.95) 0.1s"
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

    datahint.innerText = `x: ${Math.round(mouse.mapX)} y: ${Math.round(mouse.mapY)}, ${Math.abs(mouseLongLat.y).toFixed(2)}°${mouseLongLat.y >= 0 ? 'N' : 'S'} ${Math.abs(mouseLongLat.x).toFixed(2)}°${mouseLongLat.x >= 0 ? 'E' : 'W'}, scale: ${view.scale.toPrecision(2)}`

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
            var distance = greatCircleDistance(mouseLongLat.x, mouseLongLat.y, locationLongLat.x, locationLongLat.y)
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
    sidebarContent.childNodes.forEach((element)=>{
        if(element?.style)
            element.style.display = "none"
    })
    var wikipage = document.querySelector(`.wiki-page.${page}`)
    if(page && wikipage){
        wikipage.style.display = "block"
    }else{
        wikipage = document.querySelector(`.wiki-page.not-found`)
        wikipage.style.display = "block"
        wikipage.firstElementChild.innerText = fallbackTitle
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
    return {x, y}
}

function polarCoordsToPixelCoords(x, y){
    x = ((x+540)%360)-180
    y = 180-((y+540)%360)
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