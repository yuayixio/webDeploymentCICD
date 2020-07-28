This is a guide to automate the deployment of a web service with GitLab CI

[[_TOC_]]

# Deployment on Remote Nginx Web-Server 

### Prerequisitions 

Although, there seemingly is a lot to do before initialising GitLab CI, most of the steps only need to be done once and can be used for all other projects afterwards. Also, the reward from bringing some automation into your coding life definetly pays the bills on that part ;)

- Enable GitLab CI in your Project (if not already) (LINK)
- Up and Running Remote Server (Here: CentOS, but possible with any other as e.g. ubuntu as well)
- Up and Running Web Server on the Remotote Server (Here: Nginx, but deployment with Apache is described in the bottom of the Readme) 
- SSH Connection to Remote Server (LINK)
    - with open ports
- Deploy private SSH key as variable in project (LINK)
    - Also have your public key deployed on the web server (LINK)
- Add Target Folder (In the following nemed "WebServer") on Deployment Server, so that the script can actually access the right location
- If you don't want/can't use a shared runner, you need to define an own gitlab runner yourself (LINK)

### Script 

First of all, you need to create the gitlab-ci.yml script. For that, you need to add a new file in your GitLab root directory and select "gitlab-ci.yml" as template. As you (probably) now, the YAML file is ordered in stages and jobs, which run on those stages. For our very simple project, which doesn't need to be built anymore, we only define one stage. Also, we will use a Docker Container to run our CI file in. For that, we use a nginx docker image.

```
image: nginx:alpine

stages: 
    - deploy
```

We will just name the job running on that stage "deploy" too. Therefore, we need to declare on which stage it is running on as well as defining it's tasks below. The Runner then will go through the script from top to bottom and execute all steps sequentally, such as you'd use the terminal to manually insert your commands

```
deploy: 
    stage: deploy
    script: 
```

First, we need to do install **rsync**, which is a service later used to copy the files to the target server and **ssh agent**, our ssh connection service

```
 ## Install rsync
  - apk update && apk add rsync

  ## Add ssh client
  - 'which ssh-agent || ( apk update && apk add openssh-client)'
```

Side note: we use an alpine distribution, which is the reason we use "apk" as our install manager. If you're using e.g. an ubuntu image, you need to replace "apk" with "apt-get".

Next, we need to develop the SSH conenction to the remote server. for that, we will make use of our previously depl

# For Apache Web Server 

You just need to conduct minor changes for an Apache Web Server in comparison to the Nginx one. The major difference here is the location of the default file. Therefore, you need to substitute the following line

LINE

with this piece of code

LINE

Your finished Script is stored in the "apache" folder. 

# Possible Sources of Errors 

- Invalid YAML file
    - Space sensitive!! Try to avoid unnecessary tabs/white spaces


- Ports/Firewall not open
-



