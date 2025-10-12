# Circuits

Circuits web service that given a structure jason file that describes a circuit, can run throught the circuit.

The circuit will be described as [Name, descriptions, duration]

The webservice can store multiple circuits

A user can click on a circuit to tview the circuit as tabel

There will be a settings icon on each circuit page where you can view the json and edit

A user can upload or input json file or stings to create the circuit

There is a json schema that can be exported to help AI Agents build circuits with an asistance prompt

When a circuit is run, It will show the Name of the circuit as a header, the descripoins and the time remaining, 
 Below the time in a faded letters will be the next task
 The user can configure what happedn when the timer finishes (sounds [users can select before starting, or vibration)
 the user can toggle on/off the 5 seconds left countdown sound or vibration, That sound is already defined)
 The user can also pause then stop the circuit. 

 All data is stored to local sqlite db


The app uses material UI designs and can be install on android phones as web app

The service can run using a setup.sh which will install the venv , dependenaces and run thers service

There is also a dockerFile and docker-compose file to build the image and run on docker

The app is self contained in a single service (Hosting the UI and the backend apis)
