# Guide on integrating GitLab CI into the development of Web Projects 


## Introduction

This is a guide to automate the deployment of a web service with the usage of GitLab Continuous Integration/Continuous Deployment. Detailed information on GitLab CI/CD can be reread [here](https://docs.gitlab.com/ee/ci/). 

Basically, GitLab provides developers with built in tools to automate the build, delivery and deployment of software. We are going to make use of that by automatically deploying web applications, whenever a new push on the repository is done. By that, we are able to immediatly see/test the new changes and always have access to the up-to-date version, without needing to update it manually by hand. To do so, we implement a script which is automatically executed on code updates. 

This project provides a very simple web-application involving an index.html file as well as a JS and a CSS file for functionality and style. On basis of this project, a gitlab-ci.yml file is created in order to enable the automated deployment of the web-application. This Readme describes the requirements needed and a step-by-step guide of how to integrate a similar process into your project. 


## Deployment on Remote Nginx Web-Server 

### Requirements 

Although, seemingly there is a lot to do before initialising GitLab CI, most of the steps only need to be done once and can be re-used for all other projects afterwards. Also, the reward from bringing some automation into your coding life definitely pays the bills on that part :v:

- **Enable GitLab CI** in your Project (if not already) ([How-To](https://docs.gitlab.com/ee/ci/enable_or_disable_ci.html#per-project-user-setting))
- Up and Running **Remote Server** (Here: CentOS, but possible with any other as e.g. ubuntu as well)
- Up and Running **Web Server** on the Remote Server (Here: Nginx, but deployment with Apache is described in the bottom of the Readme) 
- **SSH Connection** to Remote Server ([How-To](https://phoenixnap.com/kb/ssh-to-connect-to-remote-server-linux-or-windows))
    - with **open ports** ([How-To](https://www.papercut.com/support/resources/manuals/ng-mf/common/topics/customize-enable-additional-ports.html))
- Create new **SSH Keypair WITHOUT a passphrase** ([How-To](https://www.ssh.com/ssh/keygen/))
    - *Deploy private SSH key* as variable in **project** ([How-To](https://docs.gitlab.com/ee/ci/variables/#create-a-custom-variable-in-the-ui))
    - Also have your *public key* deployed on the **remote server** ([How-To](https://kb.iu.edu/d/aews))
- Add **Target Folder** (In the following named "WebServer") on Deployment Server, so that the script can actually access the right location and copy the files into it
- SITUATIONAL: If you don't want/can't use a shared runner, you need to **define an own gitlab runner** yourself ([How-To](https://docs.gitlab.com/runner/register/index.html))
- OPTIONAL: **sudo rights** of the user you're gonna access the remote server with, or enable that in GitLab CI directly ([How-To](https://stackoverflow.com/questions/19383887/how-to-use-sudo-in-build-script-for-gitlab-ci/37800985))

### Script 

First of all, you need to create the .gitlab-ci.yml script. For that, you need to add a new file in your GitLab root directory and select ".gitlab-ci.yml" as template. The YAML file is ordered in stages and jobs, which run on those stages. For our very simple project, which doesn't need to be built anymore, we only define one stage. Also, we will use a Docker Container to run our CI file in. For that, we use an Ubuntu docker image.

#### Head & Structure

```yaml
image: ubuntu:18.04

stages: 
    - deploy
```

We will just name the job running on that stage "deploy" too. Therefore, we need to declare on which stage it is running on as well as defining its tasks below. The Runner then will go through the script from top to bottom and execute all steps sequentally.

```yaml
deploy: 
    stage: deploy
    script: 
```

#### Install packages

First, we need to do install **rsync**, which is a service later used to copy the files to the target server and **ssh agent**, our ssh connection service

```yaml
 ## Install rsync
  - apt-get update && apt-get add rsync

  ## Add ssh client
  - 'which ssh-agent || ( apt-get update && apt-get add openssh-client)'
```

*Side note: you can also use an alpine distribution, in which case you'd need to replace the "apt-get" commands with "apk", the default alpine installation manager.*

#### Connect to ssh

Next, we need to develop the SSH connection to the remote server. For that, we will make use of our previously deployed SSH key. 

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
 This can be pretty much copied for every remote server connection. The ssh-agent is first activated and the deployed key accessed over the pre-defined syntax "$KEYVARIABLENAME". Ultimately, the ssh connection is checked by accessing our pre-defined folder. Now, the actual data transfer happens. We are going to transfer the files from the GitLab repository to the remote server. 

#### Copying of repo to server 

To do so, we will make use of a temporary folder, which then is swapped with the old files. By first importing the file and then swapping folders locally, we reduce latency and prevent down-times.

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
- **IP** -> Your server's IP adress **or** domain name
- **WebProject(OLD/TEMP)** -> Your project name/preferred folder structure
- **./www/** in the rsync command -> Dependent on the folder/file structure of your project. Removing this parameter will make the command copy your whole repository over. Adjust it according to your needs.  

This obviously applies to the before mentioned SSH conenction as well.

#### Change target destination of root service 

Next, the root location of the web server needs to be adjusted. If this was done before, the command will be skipped. Hereby, we ensure that the correct folder is adressed by the nginx server, either because it is the first initiation or because other projects were using the server in between. This is accomplished by using a simple regular expression supported substitution.

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "sudo sed -i 's/root =.*/root = ~\/WebProject/g' /etc/nginx/sites-enabled/default"
```

This is just a simple text exchange based on regular expressions. If you've got any problems with "sudo", scroll to the "Possible Sources of Error". If you're using a differet web-server you might want to adjust this step accordingly, based on the server configuration. Finally, you can access/refresh the page via your browser of choice and can spectate your automatically deployed changes.

The full file can be found in this project in the root directory.

## For Apache Web Server 

You just need to conduct minor changes for an Apache Web Server in comparison to the Nginx one. The major difference here is the location of the default file. Therefore, you need to substitute the following lines

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "sudo sed -i 's/root =.*/root = ~\/WebProject/g' /etc/nginx/sites-enabled/default"
```

with this piece of code

```yaml
    ## Replace the definition of the target  site 
  - ssh user@IP "cd /etc/httpd/conf/"
  - ssh user@IP "sed -i 's/DocumentRoot "/var/www/html"/DocumentRoot "~/Webproject"/g' httpd.conf"
  
  ## Optional, if .html file is not named "index" (Replace "INDEXNAME" with according name) 
  #- ssh USER@HOSTNAMEORADRESS "sed -i 's/DirectoryIndex index.html/DirectoryIndex INDEXNAME.html/g' httpd.conf"
```

Depending how your .html main file is called, you might want to uncomment the last and replace the INDEXNAME placeholder with the according filename. An example Script is stored in the "apache" folder. 

## Possible Sources of Errors 

- Invalid YAML file
    -> Space sensitive!! Try to avoid unnecessary tabs/white spaces
- Ports/Firewall not open
    -> ssh, http, https...
- Sudo rights of the user
    -> Make use of local variable (the sudo password) and add *echo $PASSWORD_VARIABLE | * in the same row in front of your *sudo someSudoCommands*
    -> [Alternative Solution](https://stackoverflow.com/questions/19383887/how-to-use-sudo-in-build-script-for-gitlab-ci)
- Not alpine distribution (apk not working)
- Web server not allowed to access copied repository
    -> chmod (but take care of sensitive data)
Incorrect ssh configuration or key-pair
    -> Save public key on *~/ssh/authorized_keys*

## GitLab Runner

The GitLab Runner is the tool used to run your jobs and send the results back to GitLab. It is basically the executing part of GitLab CI, following the tasks defined in the *gitlab-ci.yml* file. The detailed instructions of registering a runner can be found [How-To](https://docs.gitlab.com/runner/register/index.html) here. The Gitlab Runner can have different forms, such as a docker container or a virtual command shell. Per default, gitlab.com provides pre-defined Shared Runner. These are running on their own servers.

However, since we work on an gitlab sub instance, we cannot make use of these runners. Therefore, in order to have a shared runner, we created an own "Shared" Runner for everyone to implement in their project.

It is running on a CentOS Server from the research group, to be found under the domain *xxx*. In order to make it as generic as possible, this runner was defined as a docker container with an ubuntu 18.04 image. Activating it for your project is fairly easy and only requires the following steps:

1.) Activate GitLab CI for your project (as described in the beginning of this Readme ([How-To](https://docs.gitlab.com/ee/ci/enable_or_disable_ci.html#per-project-user-setting)))
2.) Select Runner on CI settings 
    *Settings -> CI/CD -> Runner -> Specific Runner -> Select Runner with Tags "Docker, Ubuntu, onCentOS" ([Link](https://git.scc.kit.edu/utehf/example-web-project/runners/xxxx)) and press "Activate for this project*
3.) GitLab now uses the Runner automatically on your next commit (if you created a .gitlab-ci.yml file)
    *Please note that Runner "only" look out for new jobs every 3 seconds, so your pipeline might be stuck for a couple of seconds before executing*




