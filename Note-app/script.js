var addbtn = document.getElementById("add-Popup-btn");
var popupoverlay = document.querySelector(".popup-overlay");
var popup = document.querySelector(".popup");


addbtn.addEventListener("click", function() {
    popupoverlay.style.display = "block";
    popup.style.display = "block";
})

function closePopUp(event) {
    event.preventDefault()
    popupoverlay.style.display = "none";
    popup.style.display = "none";
}

var bigbox = document.querySelector(".big-box");
var addnotebutton = document.getElementById("add-Note-btn");
var notetitleinput = document.getElementById("note-title");
var noteauthorinput = document.getElementById("note-author");
var notedescriptioninput = document.getElementById("note-description");

addnotebutton.addEventListener("click", function(event) {
    event.preventDefault();
    var div = document.createElement("div");
    div.className = "note-box";
    div.innerHTML = `<h2>${notetitleinput.value}</h2><h5>${noteauthorinput.value}</h5><p>${notedescriptioninput.value}</p><button type="button" class="delete-note">Delete</button>`;
    bigbox.append(div); 
    popupoverlay.style.display = "none";
    popup.style.display = "none";

    var deleteBtn = div.querySelector(".delete-note");
    deleteBtn.addEventListener("click", deleteItem);
});

function deleteItem(event) {
    event.preventDefault();
    event.target.parentElement.remove();
}

