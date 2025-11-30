//go:build (windows && amd64) || darwin
// +build windows,amd64 darwin

package gui

import (
	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/layout"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

func isAvailable() bool {
	return true
}

func showLoginDialog(defaultHost, defaultUsername string) LoginResult {
	result := LoginResult{}

	a := app.New()
	a.Settings().SetTheme(theme.DarkTheme())

	w := a.NewWindow("Vento Agent - Connect")
	w.Resize(fyne.NewSize(400, 280))
	w.CenterOnScreen()
	w.SetFixedSize(true)

	// Title
	title := widget.NewLabelWithStyle("Vento Agent", fyne.TextAlignCenter, fyne.TextStyle{Bold: true})
	subtitle := widget.NewLabelWithStyle("Enter connection details", fyne.TextAlignCenter, fyne.TextStyle{})

	// Form fields
	hostEntry := widget.NewEntry()
	hostEntry.SetPlaceHolder("http://localhost:8000")
	if defaultHost != "" {
		hostEntry.SetText(defaultHost)
	}

	userEntry := widget.NewEntry()
	userEntry.SetPlaceHolder("admin")
	if defaultUsername != "" {
		userEntry.SetText(defaultUsername)
	} else {
		userEntry.SetText("admin")
	}

	passEntry := widget.NewPasswordEntry()
	passEntry.SetPlaceHolder("Password")

	// Status label for errors
	statusLabel := widget.NewLabelWithStyle("", fyne.TextAlignCenter, fyne.TextStyle{})
	statusLabel.Wrapping = fyne.TextWrapWord

	// Buttons
	var connectBtn *widget.Button
	connectBtn = widget.NewButton("Connect", func() {
		host := hostEntry.Text
		user := userEntry.Text
		pass := passEntry.Text

		if host == "" {
			statusLabel.SetText("⚠️ Please enter the server URL")
			return
		}
		if user == "" {
			statusLabel.SetText("⚠️ Please enter the username")
			return
		}
		if pass == "" {
			statusLabel.SetText("⚠️ Please enter the password")
			return
		}

		result.Host = host
		result.Username = user
		result.Password = pass
		result.OK = true
		w.Close()
	})
	connectBtn.Importance = widget.HighImportance

	cancelBtn := widget.NewButton("Cancel", func() {
		result.OK = false
		w.Close()
	})

	// Handle Enter key
	passEntry.OnSubmitted = func(_ string) {
		connectBtn.OnTapped()
	}

	// Layout
	form := container.NewVBox(
		widget.NewLabel("Server:"),
		hostEntry,
		widget.NewLabel("Username:"),
		userEntry,
		widget.NewLabel("Password:"),
		passEntry,
	)

	buttons := container.NewHBox(
		layout.NewSpacer(),
		cancelBtn,
		connectBtn,
	)

	content := container.NewVBox(
		title,
		subtitle,
		widget.NewSeparator(),
		form,
		statusLabel,
		layout.NewSpacer(),
		buttons,
	)

	// Add padding
	padded := container.NewPadded(content)

	w.SetContent(padded)

	// Handle window close
	w.SetOnClosed(func() {
		a.Quit()
	})

	w.ShowAndRun()

	return result
}
