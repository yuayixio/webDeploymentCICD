# Guide on integrating GitLab CI into the development of Web Projects 

[[_TOC_]]

This is a guide to automate the deployment of a web service with the usage of GitLab Continuous Integration/Continuous Deployment. Detailed information on GitLab CI/CD can be reread [here](https://docs.gitlab.com/ee/ci/). 

Basically, GitLab provides developers with built in tools to automate the build, delivery and deployment of software. We are going to make use of that by automatically deploying web applications, whenever a new push on the repository is done. By that, we are able to immediatly see/test the new changes and always have access to the up-to-date version, without needing to update it manually by hand. To do so, we implement a script into our framework which is automatically executed on code updates. 

This project provides a very simple web-application involving an index.html file as well as a JS and a CSS file for functionality and style. On basis of this project, a gitlab-ci.yml file is created in order to enable the automated deployment of the web-applciation. This Readme describes the pre-requirements needed and a step-by-step guide of how to integrate a similar process into your project. 


# Deployment on Remote Nginx Web-Server 

### Prerequisitions 

Although, seemingly there is a lot to do before initialising GitLab CI, most of the steps only need to be done once and can be re-used for all other projects afterwards. Also, the reward from bringing some automation into your coding life definitely pays the bills on that part :v:

- **Enable GitLab CI** in your Project (if not already) ([How-To](hhttps://docs.gitlab.com/ee/ci/enable_or_disable_ci.html#per-project-user-setting))
- Up and Running **Remote Server** (Here: CentOS, but possible with any other as e.g. ubuntu as well)
- Up and Running **Web Server** on the Remotote Server (Here: Nginx, but deployment with Apache is described in the bottom of the Readme) 
- **SSH Connection** to Remote Server ([How-To](https://phoenixnap.com/kb/ssh-to-connect-to-remote-server-linux-or-windows))
    - with **open ports** ([How-To](https://www.papercut.com/support/resources/manuals/ng-mf/common/topics/customize-enable-additional-ports.html))
- Create new **SSH Keypair WITHOUT a passphrase** ([How-To](https://www.ssh.com/ssh/keygen/))
    - *Deploy private SSH key* as variable in **project** ([How-To](https://docs.gitlab.com/ee/ci/variables/#create-a-custom-variable-in-the-ui))
    - Also have your *public key* deployed on the **remote server** ([How-To](https://kb.iu.edu/d/aews))
- Add **Target Folder** (In the following nemed "WebServer") on Deployment Server, so that the script can actually access the right location and copy the files into it
- SITUATIONAL: If you don't want/can't use a shared runner, you need to **define an own gitlab runner** yourself ([How-To](https://docs.gitlab.com/runner/register/index.html))
- OPTIONAL: **sudo rights** of the user you're gonna access the remote server with, or enable that in GitLab CI directly ([How-To](https://stackoverflow.com/questions/19383887/how-to-use-sudo-in-build-script-for-gitlab-ci/37800985))

### Script 

First of all, you need to create the gitlab-ci.yml script. For that, you need to add a new file in your GitLab root directory and select "gitlab-ci.yml" as template. As you (probably) now, the YAML file is ordered in stages and jobs, which run on those stages. For our very simple project, which doesn't need to be built anymore, we only define one stage. Also, we will use a Docker Container to run our CI file in. For that, we use a nginx docker image.

```yaml
image: ubuntu:18.04

stages: 
    - deploy
```

We will just name the job running on that stage "deploy" too. Therefore, we need to declare on which stage it is running on as well as defining it's tasks below. The Runner then will go through the script from top to bottom and execute all steps sequentally, such as you'd use the terminal to manually insert your commands

```yaml
deploy: 
    stage: deploy
    script: 
```

First, we need to do install **rsync**, which is a service later used to copy the files to the target server and **ssh agent**, our ssh connection service

```yaml
 ## Install rsync
  - apk update && apk add rsync

  ## Add ssh client
  - 'which ssh-agent || ( apk update && apk add openssh-client)'
```

Side note: we use an alpine distribution, which is the reason we use "apk" as our install manager. If you're using e.g. an ubuntu image, you need to replace "apk" with "apt-get".

Next, we need to develop the SSH conenction to the remote server. for that, we will make use of our previously deployed SSH key. 

```yaml
  ##  Run ssh-agent (inside the build environment)
  - eval "$(ssh-agent -s)"
  
  ## Add the SSH key variable to the agent store
  - echo "$DEPLOY_KEY" | ssh-add -
  
  ## Create the SSH directory and give it the right permissions 
  - mkdir -p ~/.ssh
  - chmod 700 ~/.ssh
  
  ## Host key verification fix
  - '[[ -f /.dockerenv ]] && echo -e "Host *\n\tStrictHostKeyChecking no\n\n" > ~/.ssh/config'
  
  ## Check local files
  - ls

  ## Check remote access
  - ssh user@IP "ls -l ~/WebProject"
```
 This can be pretty much copied for every remote server connection. The ssh-agent is first activated and the deployed key accessed over the pre-defined syntax "$KEYVARIABLENAME". Ultimately, the ssh connection is checked by accessing our pre-defined folder. Now, the actual data transfer happens. We are going to transfer the files from the GitLab repository to the remote server. To do so, we will make use of an temporary folder, which then is swapped with the old files. By first importing the file and then swapping folders locally, we reduce latency and prevent down-times.

 ```yaml
    # Create temp folder structure if not existing
  - ssh user@IP "mkdir -p ~/WebProjectTEMP"

  ##  Copy files; just use "www" folder (in which the .html file is stored)
  - rsync -a --delete --stats ./www/ user@IP:~/WebProjectTEMP

  ## Check successful copy
  - ssh user@IP "ls -l ~/WebProjectTEMP"

  ## Move existing directory in Outdated folder and new one in the main one
  - ssh user@IP "mv ~/WebProject ~/WebProjectOLD && mv ~/WebProjectTEMP ~/WebProject" 

  ## Remove old directory
  - ssh user@IP "sudo rm -rf  ~/WebProjectOLD"
 ```
Again, this can be pretty much copy-pasted too. Just some variables need to be adjusted to your own settings.

- **user** -> Your access name for the remote server (optionally with sudo rights)
- **IP** -> Your server's IP adress or domain name
- **WebProject(OLD/TEMP)** -> Your project name/preferred folder structure
- **./www/** in the rsync command -> Dependent on the folder/file structure of your project. Removing this parameter will make the command copy your whole repository over. Adjust it according to your needs.  

This obviously applies for the before mentioned SSH conenction as well.

Next, the root location of the web server needs to be adjusted. If this was done before, the command will be skipped. Hereby, we ensure that the correct folder is adressed by the nginx server, either because it is the first initiation or because other projects were using the server in between. 

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "line = Get-Content /etc/nginx/sites-enabled/default | select-string root | select-object -ExpandProperty Line"
  - ssh user@IP "content = Get-Content /etc/nginx/sites-enabled/default"
  - ssh user@IP "content | ForEach-Object {$_ -replace $line,"root = ~/WebProjectOLD"} | Set-Content /etc/nginx/sites-enabled/default"
```

Here is, where using different web servers changes the yaml file. If you're using a differet web-server you might want to adjust this step accordingly. Finally, you can access/refresh the page via your browser of choice and can spectate your automatically deployed changes.

The full file can be found in this project in the root directory.

# For Apache Web Server 

You just need to conduct minor changes for an Apache Web Server in comparison to the Nginx one. The major difference here is the location of the default file. Therefore, you need to substitute the following lines

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "line = Get-Content /etc/nginx/sites-enabled/default | select-string root | select-object -ExpandProperty Line"
  - ssh user@IP "content = Get-Content /etc/nginx/sites-enabled/default"
  - ssh user@IP "content | ForEach-Object {$_ -replace $line,"root = ~/WebProjectOLD"} | Set-Content /etc/nginx/sites-enabled/default"
```

with this piece of code

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "cd /etc/httpd/conf/"
  - ssh user@IP "sed -i 's/DocumentRoot "/var/www/html"/DocumentRoot "~/moed/www"/g' httpd.conf"
  ## Optional, if .html file is not named "index" 
  - ssh user@IP "sed -i 's/DirectoryIndex index.html/DirectoryIndex INDEXNAME.html/g' httpd.conf"
```

An example Script is stored in the "apache" folder. 

# Possible Sources of Errors 

- Invalid YAML file
    -> Space sensitive!! Try to avoid unnecessary tabs/white spaces
- Ports/Firewall not open
- Sudo rights of the user
- Not alpine distribution (apk not working)


# Runner for Research Group

The GitLab Runner is the tool used to run your jobs and send the results back to GitLab. It basically the executing part of GitLab CI, responsible with following the task defined in the *gitlab-ci.yml* file. The detailed instructions of registering a runner can be found [How-To](https://docs.gitlab.com/runner/register/index.html) here.

However, in order to have a shared runner for the research group, 



